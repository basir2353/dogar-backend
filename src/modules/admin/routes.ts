import { UserRole } from "../../shared/index.js";
import { Router } from "express";
import { CampaignStatus } from "@prisma/client";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../config/prisma";
import { defaultLandingCopy, readLandingContent, writeLandingContent, type LandingCopy } from "../../config/landing-content";
import { readAboutContent, writeAboutContent, parseAboutPayload } from "../../services/site-about";
import { requireAuth, requireRole } from "../../middleware/auth";
import { isDbUnavailable, sendServiceUnavailable } from "../../utils/db-availability";
import { fail, ok } from "../../utils/response";

const router = Router();
const profileOptionsFilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.profile-options.json");
const DEFAULT_CASTES = ["Dogar", "Jutt", "Rajput", "Sheikh", "Arain"];
const readCasteOptions = async () => {
  try {
    const raw = await fs.readFile(profileOptionsFilePath, "utf-8");
    const parsed = JSON.parse(raw) as { castes?: string[] };
    const castes = (parsed.castes ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return castes.length > 0 ? castes : DEFAULT_CASTES;
  } catch {
    return DEFAULT_CASTES;
  }
};

const writeCasteOptions = async (castes: string[]) => {
  await fs.writeFile(profileOptionsFilePath, JSON.stringify({ castes }, null, 2), "utf-8");
};

router.get("/kpis", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (_req, res) => {
  try {
    const [users, posts, campaigns, donations] = await Promise.all([
      prisma.user.count(),
      prisma.communityPost.count(),
      prisma.campaign.count(),
      prisma.donation.aggregate({ _sum: { amount: true } })
    ]);

    return res.json(ok({
      totalUsers: users,
      totalPosts: posts,
      totalCampaigns: campaigns,
      totalDonations: donations._sum.amount ?? 0
    }));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.get("/moderation", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (_req, res) => {
  try {
    const pendingProfiles = await prisma.profile.findMany({
      where: { verificationStatus: "PENDING" },
      include: { user: { select: { id: true, email: true, role: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    const userIds = pendingProfiles.map((p) => p.userId);
    const matRows =
      userIds.length === 0
        ? []
        : await prisma.matrimonialProfile.findMany({
            where: { userId: { in: userIds } },
            include: { images: { orderBy: { sortOrder: "asc" } } }
          });
    const matByUser = new Map(matRows.map((m) => [m.userId, m]));
    const pendingWithDetails = pendingProfiles.map((p) => ({
      ...p,
      matrimonial: matByUser.get(p.userId) ?? null
    }));
    return res.json(ok(pendingWithDetails));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.patch("/moderation/:profileId", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (req, res) => {
  const parsed = z.object({
    status: z.enum(["VERIFIED", "REJECTED"])
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid moderation payload"));
  }

  const profile = await prisma.profile.update({
    where: { id: String(req.params.profileId) },
    data: {
      verificationStatus: parsed.data.status
    }
  });

  return res.json(ok(profile));
});

/** All member profiles (rishta + media) for admin review — not limited to the pending queue. */
router.get(
  "/members",
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]),
  async (_req, res) => {
    try {
      const profiles = await prisma.profile.findMany({
        include: { user: { select: { id: true, email: true, role: true, createdAt: true } } },
        orderBy: { updatedAt: "desc" },
        take: 500
      });
      const userIds = profiles.map((p) => p.userId);
      if (userIds.length === 0) {
        return res.json(ok([]));
      }
      const matrimonialRows = await prisma.matrimonialProfile.findMany({
        where: { userId: { in: userIds } },
        include: { images: { orderBy: { sortOrder: "asc" } } }
      });
      const matByUser = new Map<string, (typeof matrimonialRows)[0]>(matrimonialRows.map((m) => [m.userId, m]));
      const rows = profiles.map((p) => ({ ...p, matrimonial: matByUser.get(p.userId) ?? null }));
      return res.json(ok(rows));
    } catch (error) {
      if (!isDbUnavailable(error)) {
        throw error;
      }
      return sendServiceUnavailable(res);
    }
  }
);

router.post("/campaigns", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (req, res) => {
  const parsed = z.object({
    title: z.string().trim().min(3),
    description: z.string().trim().min(10),
    goalAmount: z.coerce.number().positive(),
    isVerified: z.boolean().optional()
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid campaign payload"));
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        goalAmount: parsed.data.goalAmount,
        status: CampaignStatus.ACTIVE,
        isVerified: parsed.data.isVerified ?? true
      }
    });

    return res.status(201).json(ok(campaign));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.get("/community/posts", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (_req, res) => {
  try {
    const posts = await prisma.communityPost.findMany({
      include: {
        author: { include: { profile: true } },
        comments: true,
        likes: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return res.json(ok(posts));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.delete("/community/posts/:postId", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (req, res) => {
  await prisma.communityPost.delete({
    where: { id: String(req.params.postId) }
  });
  return res.json(ok({ removed: true }));
});

router.get("/profile-options/castes", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR]), async (_req, res) => {
  const castes = await readCasteOptions();
  return res.json(ok({ castes }));
});

router.post("/profile-options/castes", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]), async (req, res) => {
  const parsed = z.object({
    name: z.string().min(2)
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid caste/biradari name"));
  }

  const existing = await readCasteOptions();
  const normalized = parsed.data.name.trim();
  const hasAlready = existing.some((item) => item.toLowerCase() === normalized.toLowerCase());
  if (hasAlready) {
    return res.status(409).json(fail("ALREADY_EXISTS", "Caste/Biradari already exists"));
  }

  const updated = [...existing, normalized].sort((a, b) => a.localeCompare(b));
  await writeCasteOptions(updated);
  return res.status(201).json(ok({ castes: updated }));
});

router.get("/content/about", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]), async (_req, res) => {
  try {
    const data = await readAboutContent();
    return res.json(ok(data));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.put("/content/about", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]), async (req, res) => {
  const parsed = parseAboutPayload(req.body);
  if (!parsed.ok) {
    return res.status(400).json(fail("VALIDATION_ERROR", parsed.error));
  }
  try {
    const data = await writeAboutContent(parsed.data);
    return res.json(ok(data));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.get("/content/landing", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]), async (_req, res) => {
  const content = await readLandingContent();
  return res.json(ok(content));
});

router.put("/content/landing", requireAuth, requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]), async (req, res) => {
  const parsed = z
    .object({
      heroBadge: z.string().min(1),
      heroTitle: z.string().min(3),
      heroSubtitle: z.string().min(3),
      ctaFindRishta: z.string().min(1),
      ctaCommunity: z.string().min(1),
      ctaDonate: z.string().min(1),
      howItWorksTitle: z.string().min(1),
      howItWorksSteps: z.array(z.string().min(1)).min(1),
      featuredProfilesTitle: z.string().min(1),
      donationImpactTitle: z.string().min(1),
      communityPreviewTitle: z.string().min(1)
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid landing content payload"));
  }

  const merged: LandingCopy = {
    ...defaultLandingCopy,
    ...parsed.data
  };
  await writeLandingContent(merged);
  return res.json(ok(merged));
});

export default router;
