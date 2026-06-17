import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { findOrCreateDirectConversation } from "../../lib/direct-conversation";
import { getSocketIO } from "../../lib/realtime";
import { MAX_MATRIMONIAL_IMAGES, pickBannerUrl } from "../../lib/matrimonial-media";
import { storageAdapter } from "../../utils/storage";
import { fail, ok } from "../../utils/response";
import { compatibilityScore } from "./scoring";
import { randomBytes } from "node:crypto";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "image";

const DISCOVER_MAX = 500;

function parseDiscoverLimit(value: unknown): number {
  const n = Number.parseInt(String(value ?? "200"), 10);
  if (Number.isNaN(n) || n < 1) {
    return 200;
  }
  return Math.min(DISCOVER_MAX, n);
}

router.get("/discover", requireAuth, async (req: AuthRequest, res) => {
  const cityRaw = req.query.city;
  const city = typeof cityRaw === "string" && cityRaw.trim() ? cityRaw.trim() : undefined;
  const ageMinRaw = Number.parseInt(String(req.query.ageMin ?? ""), 10);
  const ageMaxRaw = Number.parseInt(String(req.query.ageMax ?? ""), 10);
  const professionRaw = req.query.profession;
  const profession = typeof professionRaw === "string" && professionRaw.trim() ? professionRaw.trim() : undefined;
  const take = parseDiscoverLimit(req.query.limit);
  const viewerId = req.user!.userId;
  const own = await prisma.matrimonialProfile.findUnique({
    where: { userId: viewerId },
    include: { user: { include: { profile: true } } }
  });

  const profileCityFilter = city
    ? { city: { equals: city, mode: "insensitive" as const } }
    : {};
  const ageFilter: { gte?: number; lte?: number } = {};
  if (!Number.isNaN(ageMinRaw)) ageFilter.gte = ageMinRaw;
  if (!Number.isNaN(ageMaxRaw)) ageFilter.lte = ageMaxRaw;
  const professionFilter = profession
    ? { profession: { contains: profession, mode: "insensitive" as const } }
    : {};

  const rows = await prisma.matrimonialProfile.findMany({
    where: {
      userId: { not: viewerId },
      ...(Object.keys(ageFilter).length > 0 ? { age: ageFilter } : {}),
      ...professionFilter,
      user: {
        profile: {
          verificationStatus: VerificationStatus.VERIFIED,
          ...profileCityFilter
        }
      }
    },
    include: {
      user: { include: { profile: true } },
      images: { orderBy: { sortOrder: "asc" } }
    },
    take,
    orderBy: { updatedAt: "desc" }
  });

  const out = await Promise.all(
    rows.map(async (m) => {
      let matchScore = 0;
      if (own) {
        const rec = await prisma.matchRecommendation.findFirst({
          where: { matrimonialProfileId: own.id, recommendedUserId: m.userId }
        });
        if (rec) {
          matchScore = Math.min(100, Math.round(rec.score));
        } else {
          matchScore = compatibilityScore({
            ageA: own.age,
            ageB: m.age,
            sameCity: own.user.profile?.city === m.user.profile?.city,
            sameSect: Boolean(own.sect && m.sect && own.sect === m.sect),
            educationCompatibility: 70,
            professionCompatibility: 70
          });
        }
      }
      return {
        ...m,
        matchScore,
        bannerUrl: pickBannerUrl(m.images, m.user.profile)
      };
    })
  );

  return res.json(
    ok(out, {
      /** Client can explain why count may be one less than “Featured” on the home page. */
      discoverExcludesViewer: true,
      viewerUserId: viewerId,
      resultCount: out.length
    })
  );
});

router.get("/profile/:userId", requireAuth, async (req: AuthRequest, res) => {
  const targetId = String(req.params.userId);
  if (targetId === req.user!.userId) {
    return res.status(400).json(fail("INVALID_REQUEST", "Use your profile page for your own account"));
  }

  const row = await prisma.user.findFirst({
    where: { id: targetId },
    include: {
      profile: true,
      matrimonial: { include: { images: { orderBy: { sortOrder: "asc" } } } }
    }
  });

  if (!row?.matrimonial) {
    return res.status(404).json(fail("NOT_FOUND", "Profile not found"));
  }

  if (row.profile?.verificationStatus !== VerificationStatus.VERIFIED) {
    return res.status(404).json(fail("NOT_FOUND", "Profile not found"));
  }

  const own = await prisma.matrimonialProfile.findUnique({
    where: { userId: req.user!.userId },
    include: { user: { include: { profile: true } } }
  });
  let matchScore: number | null = null;
  if (own) {
    const rec = await prisma.matchRecommendation.findFirst({
      where: { matrimonialProfileId: own.id, recommendedUserId: targetId }
    });
    if (rec) {
      matchScore = Math.min(100, Math.round(rec.score));
    } else {
      matchScore = compatibilityScore({
        ageA: own.age,
        ageB: row.matrimonial.age,
        sameCity: own.user.profile?.city === row.profile?.city,
        sameSect: Boolean(own.sect && row.matrimonial.sect && own.sect === row.matrimonial.sect),
        educationCompatibility: 70,
        professionCompatibility: 70
      });
    }
  }

  return res.json(
    ok({
      userId: row.id,
      profile: row.profile,
      matrimonial: row.matrimonial,
      matchScore,
      bannerUrl: pickBannerUrl(row.matrimonial.images, row.profile)
    })
  );
});

router.post("/interests", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      receiverId: z.string().min(1),
      message: z.string().max(1_000).optional()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid interest payload"));
  }

  if (parsed.data.receiverId === req.user!.userId) {
    return res.status(400).json(fail("INVALID_REQUEST", "Cannot send interest to yourself"));
  }

  const receiverProfile = await prisma.profile.findUnique({
    where: { userId: parsed.data.receiverId }
  });
  if (!receiverProfile || receiverProfile.verificationStatus !== VerificationStatus.VERIFIED) {
    return res.status(400).json(
      fail("NOT_AVAILABLE", "This profile is not available for interest (not verified on the platform).")
    );
  }

  const interest = await prisma.matchInterest.upsert({
    where: { senderId_receiverId: { senderId: req.user!.userId, receiverId: parsed.data.receiverId } },
    update: { message: parsed.data.message },
    create: {
      senderId: req.user!.userId,
      receiverId: parsed.data.receiverId,
      message: parsed.data.message
    }
  });

  const conv = await findOrCreateDirectConversation(req.user!.userId, parsed.data.receiverId);
  const note = parsed.data.message?.trim();
  const body = note
    ? `Rishta interest: ${note}`
    : "I am interested in your rishta profile. You can open my profile from the Matrimonial section.";
  const message = await prisma.message.create({
    data: { conversationId: conv.id, senderId: req.user!.userId, body }
  });
  getSocketIO()?.to(`conversation:${conv.id}`).emit("message:new", message);

  return res.status(201).json(ok(interest));
});

router.post("/photos", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json(fail("VALIDATION_ERROR", "file is required"));
  }
  const mime = req.file.mimetype;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Only JPEG, PNG, WebP, or GIF images are allowed"));
  }
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const mp = await prisma.matrimonialProfile.findUnique({ where: { userId: req.user!.userId } });
  if (!mp) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Create a matrimonial profile first"));
  }
  const count = await prisma.matrimonialImage.count({ where: { matrimonialProfileId: mp.id } });
  if (count >= MAX_MATRIMONIAL_IMAGES) {
    return res.status(400).json(fail("VALIDATION_ERROR", `You can upload at most ${MAX_MATRIMONIAL_IMAGES} photos`));
  }
  const key = `matrimonial/${req.user!.userId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const url = await storageAdapter.upload(key, req.file.buffer);
  const image = await prisma.matrimonialImage.create({
    data: {
      matrimonialProfileId: mp.id,
      url,
      sortOrder: count,
      isBanner: count === 0
    }
  });
  if (count === 0) {
    const p = await prisma.profile.findUnique({ where: { userId: req.user!.userId } });
    if (!p?.avatarUrl) {
      await prisma.profile.update({ where: { userId: req.user!.userId }, data: { avatarUrl: url } });
    }
  }
  return res.status(201).json(ok(image));
});

router.patch("/photos/banner", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ imageId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "imageId is required"));
  }
  const mp = await prisma.matrimonialProfile.findUnique({ where: { userId: req.user!.userId } });
  if (!mp) {
    return res.status(404).json(fail("NOT_FOUND", "Matrimonial profile not found"));
  }
  const target = await prisma.matrimonialImage.findFirst({
    where: { id: parsed.data.imageId, matrimonialProfileId: mp.id }
  });
  if (!target) {
    return res.status(404).json(fail("NOT_FOUND", "Image not found"));
  }
  await prisma.$transaction([
    prisma.matrimonialImage.updateMany({
      where: { matrimonialProfileId: mp.id },
      data: { isBanner: false }
    }),
    prisma.matrimonialImage.update({
      where: { id: target.id },
      data: { isBanner: true }
    })
  ]);
  await prisma.profile.update({
    where: { userId: req.user!.userId },
    data: { avatarUrl: target.url }
  });
  return res.json(ok({ imageId: target.id, url: target.url }));
});

router.delete("/photos/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const mp = await prisma.matrimonialProfile.findUnique({ where: { userId: req.user!.userId } });
  if (!mp) {
    return res.status(404).json(fail("NOT_FOUND", "Matrimonial profile not found"));
  }
  const img = await prisma.matrimonialImage.findFirst({ where: { id, matrimonialProfileId: mp.id } });
  if (!img) {
    return res.status(404).json(fail("NOT_FOUND", "Image not found"));
  }
  await prisma.matrimonialImage.delete({ where: { id } });
  const nextBanner = await prisma.matrimonialImage.findFirst({
    where: { matrimonialProfileId: mp.id },
    orderBy: { sortOrder: "asc" }
  });
  if (nextBanner) {
    await prisma.matrimonialImage.update({ where: { id: nextBanner.id }, data: { isBanner: true } });
    await prisma.profile.update({ where: { userId: req.user!.userId }, data: { avatarUrl: nextBanner.url } });
  } else {
    await prisma.profile.update({ where: { userId: req.user!.userId }, data: { avatarUrl: null } });
  }
  return res.json(ok({ removed: true }));
});

router.get("/recommendations", requireAuth, async (req: AuthRequest, res) => {
  const own = await prisma.matrimonialProfile.findUnique({
    where: { userId: req.user!.userId }
  });

  if (!own) {
    return res.status(404).json(fail("NOT_FOUND", "Create matrimonial profile first"));
  }

  const recommendations = await prisma.matchRecommendation.findMany({
    where: { matrimonialProfileId: own.id },
    orderBy: { score: "desc" },
    take: 10
  });

  return res.json(ok(recommendations));
});

router.post("/score-preview", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      ageA: z.number().int().min(18).max(80),
      ageB: z.number().int().min(18).max(80),
      sameCity: z.boolean(),
      sameSect: z.boolean(),
      educationCompatibility: z.number().min(0).max(100),
      professionCompatibility: z.number().min(0).max(100)
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid scoring payload"));
  }

  const score = compatibilityScore(parsed.data);
  return res.json(ok({ score }));
});

router.get("/interests/received", requireAuth, async (req: AuthRequest, res) => {
  const interests = await prisma.matchInterest.findMany({
    where: { receiverId: req.user!.userId },
    include: {
      sender: {
        include: {
          profile: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return res.json(ok(interests));
});

export default router;
