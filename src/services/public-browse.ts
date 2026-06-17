import { VerificationStatus } from "@prisma/client";
import { pickBannerUrl } from "../lib/matrimonial-media";
import { prisma } from "../config/prisma";

const PUBLIC_POSTS_LIMIT = 30;
const PUBLIC_PROFILES_LIMIT = 500;

export async function listPublicCommunityPosts() {
  return prisma.communityPost.findMany({
    include: {
      likes: true,
      comments: { orderBy: { createdAt: "asc" } },
      author: { include: { profile: true } }
    },
    orderBy: { createdAt: "desc" },
    take: PUBLIC_POSTS_LIMIT
  });
}

export async function listPublicMatrimonialProfiles(options?: { city?: string; limit?: number }) {
  const take = Math.min(PUBLIC_PROFILES_LIMIT, Math.max(1, options?.limit ?? 200));
  const city = options?.city?.trim();
  const profileCityFilter = city
    ? { city: { equals: city, mode: "insensitive" as const } }
    : {};

  const rows = await prisma.matrimonialProfile.findMany({
    where: {
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

  return Promise.all(
    rows.map(async (m) => {
      const rec = await prisma.matchRecommendation.findFirst({
        where: { recommendedUserId: m.userId },
        orderBy: { score: "desc" }
      });
      return {
        userId: m.userId,
        age: m.age,
        profession: m.profession,
        education: m.education,
        aboutFamily: m.aboutFamily,
        matchScore: rec != null ? Math.min(100, Math.round(rec.score)) : 0,
        bannerUrl: pickBannerUrl(m.images, m.user.profile),
        user: m.user
      };
    })
  );
}

export async function getPublicMatrimonialProfile(userId: string) {
  const row = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      profile: true,
      matrimonial: { include: { images: { orderBy: { sortOrder: "asc" } } } }
    }
  });

  if (!row?.matrimonial || row.profile?.verificationStatus !== VerificationStatus.VERIFIED) {
    return null;
  }

  return {
    userId: row.id,
    profile: row.profile,
    matrimonial: row.matrimonial,
    matchScore: null as number | null,
    bannerUrl: pickBannerUrl(row.matrimonial.images, row.profile)
  };
}
