import { COMMUNITY_POST_LINK_MARKER } from "../../shared/index.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { fail, ok } from "../../utils/response";

const router = Router();

const optionalTrimmedString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const isAllowedImageRef = (value: string) => {
  if (value.length > 5_000_000) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(value)) return true;
  return false;
};

const isAllowedExternalLink = (value: string) => /^https?:\/\//i.test(value) || /^mailto:/i.test(value);

const postCreateSchema = z.object({
  content: z.string().trim().min(2).max(7800),
  imageUrl: optionalTrimmedString.refine((v) => v === undefined || isAllowedImageRef(v), "Invalid image URL or image data"),
  linkUrl: optionalTrimmedString.refine((v) => v === undefined || isAllowedExternalLink(v), "Invalid link URL")
});

router.get("/posts", requireAuth, async (_req, res) => {
  const posts = await prisma.communityPost.findMany({
    include: {
      likes: true,
      comments: { orderBy: { createdAt: "asc" } },
      author: { include: { profile: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  return res.json(ok(posts));
});

router.post("/posts", requireAuth, async (req: AuthRequest, res) => {
  const parsed = postCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid post payload";
    return res.status(400).json(fail("VALIDATION_ERROR", first));
  }

  const finalContent = parsed.data.linkUrl
    ? `${parsed.data.content}${COMMUNITY_POST_LINK_MARKER}${parsed.data.linkUrl}`
    : parsed.data.content;

  if (finalContent.length > 8000) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Post text and link combined are too long"));
  }

  try {
    const post = await prisma.communityPost.create({
      data: {
        authorId: req.user!.userId,
        content: finalContent,
        imageUrl: parsed.data.imageUrl
      }
    });

    return res.status(201).json(ok(post));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create post";
    return res.status(500).json(fail("POST_CREATE_FAILED", message));
  }
});

router.post("/posts/:id/comments", requireAuth, async (req: AuthRequest, res) => {
  const postId = String(req.params.id);
  const parsed = z.object({ content: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid comment payload"));
  }

  const profile = await prisma.profile.findUnique({ where: { userId: req.user!.userId } });
  const comment = await prisma.postComment.create({
    data: {
      postId,
      authorName: profile?.fullName ?? "Member",
      content: parsed.data.content
    }
  });

  return res.status(201).json(ok(comment));
});

router.post("/posts/:id/like", requireAuth, async (req: AuthRequest, res) => {
  const postId = String(req.params.id);
  await prisma.postLike.upsert({
    where: { postId_userId: { postId, userId: req.user!.userId } },
    update: {},
    create: { postId, userId: req.user!.userId }
  });
  return res.json(ok({ liked: true }));
});

router.delete("/posts/:id/like", requireAuth, async (req: AuthRequest, res) => {
  const postId = String(req.params.id);
  await prisma.postLike.deleteMany({
    where: { postId, userId: req.user!.userId }
  });
  return res.json(ok({ liked: false }));
});

export default router;
