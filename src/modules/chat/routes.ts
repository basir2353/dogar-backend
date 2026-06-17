import { randomBytes } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { findOrCreateDirectConversation } from "../../lib/direct-conversation";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { storageAdapter } from "../../utils/storage";
import { fail, ok } from "../../utils/response";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const list = await prisma.conversation.findMany({
    where: { members: { some: { userId: req.user!.userId } } },
    include: {
      members: { include: { user: { include: { profile: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json(ok(list));
});

router.get("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const conversationId = String(req.params.id);
  const exists = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: req.user!.userId }
  });

  if (!exists) {
    return res.status(403).json(fail("FORBIDDEN", "Not a member of this conversation"));
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200
  });
  return res.json(ok(messages));
});

router.post("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({
    memberUserId: z.string().min(1)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "memberUserId is required"));
  }

  if (parsed.data.memberUserId === req.user!.userId) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Cannot start a chat with yourself"));
  }

  const { id: conversationId } = await findOrCreateDirectConversation(req.user!.userId, parsed.data.memberUserId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: { include: { user: { include: { profile: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!conversation) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Conversation not found after create"));
  }

  return res.json(ok(conversation));
});

router.post("/upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json(fail("VALIDATION_ERROR", "file is required"));
  }
  const mime = req.file.mimetype;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Only JPEG, PNG, WebP, or GIF images are allowed"));
  }
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const key = `chat/${req.user!.userId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const url = await storageAdapter.upload(key, req.file.buffer);
  return res.json(ok({ url }));
});

export default router;
