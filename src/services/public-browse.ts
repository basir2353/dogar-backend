import { VerificationStatus } from "@prisma/client";
import { pickBannerUrl } from "../lib/matrimonial-media";
import { prisma } from "../config/prisma";
import {
  computeTrendingHashtags,
  filterPostsByHashtag,
  sortPostsByTrending,
  sortPostsByComments
} from "./community-feed.js";

const PUBLIC_POSTS_LIMIT = 30;
const PUBLIC_PROFILES_LIMIT = 500;

const postInclude = {
  likes: true,
  comments: { orderBy: { createdAt: "asc" as const } },
  author: { include: { profile: true } }
};

export async function listPublicCommunityPosts(options?: { sort?: string; hashtag?: string }) {
  const rows = await prisma.communityPost.findMany({
    include: postInclude,
    orderBy: { createdAt: "desc" },
    take: 100
  });
  let filtered = filterPostsByHashtag(rows, options?.hashtag);
  if (options?.sort === "trending") {
    filtered = sortPostsByTrending(filtered);
  } else if (options?.sort === "comments") {
    filtered = sortPostsByComments(filtered);
  }
  return filtered.slice(0, PUBLIC_POSTS_LIMIT);
}

export async function listPublicTrendingHashtags() {
  const rows = await prisma.communityPost.findMany({
    include: { likes: true, comments: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return computeTrendingHashtags(rows);
}


function buildMatrimonialWhere(options?: {
  city?: string;
  ageMin?: number;
  ageMax?: number;
  profession?: string;
  sect?: string;
  education?: string;
  maritalStatus?: string;
}) {
  const city = options?.city?.trim();
  const profession = options?.profession?.trim();
  const sect = options?.sect?.trim();
  const education = options?.education?.trim();
  const maritalStatus = options?.maritalStatus?.trim();
  const profileCityFilter = city
    ? { city: { equals: city, mode: "insensitive" as const } }
    : {};
  const ageFilter: { gte?: number; lte?: number } = {};
  if (options?.ageMin != null) ageFilter.gte = options.ageMin;
  if (options?.ageMax != null) ageFilter.lte = options.ageMax;
  const professionFilter = profession
    ? { profession: { contains: profession, mode: "insensitive" as const } }
    : {};
  const sectFilter = sect ? { sect: { contains: sect, mode: "insensitive" as const } } : {};
  const educationFilter = education ? { education: { contains: education, mode: "insensitive" as const } } : {};
  const maritalFilter = maritalStatus ? { maritalStatus: { contains: maritalStatus, mode: "insensitive" as const } } : {};

  return {
    user: {
      profile: {
        verificationStatus: VerificationStatus.VERIFIED,
        ...profileCityFilter
      }
    },
    ...(Object.keys(ageFilter).length > 0 ? { age: ageFilter } : {}),
    ...professionFilter,
    ...sectFilter,
    ...educationFilter,
    ...maritalFilter
  };
}

export async function listPublicMatrimonialProfiles(options?: {
  city?: string;
  ageMin?: number;
  ageMax?: number;
  profession?: string;
  sect?: string;
  education?: string;
  maritalStatus?: string;
  sort?: string;
  limit?: number;
}) {
  const take = Math.min(PUBLIC_PROFILES_LIMIT, Math.max(1, options?.limit ?? 200));
  const orderBy =
    options?.sort === "age"
      ? { age: "asc" as const }
      : options?.sort === "recent"
        ? { updatedAt: "desc" as const }
        : { updatedAt: "desc" as const };
  const rows = await prisma.matrimonialProfile.findMany({
    where: buildMatrimonialWhere(options),
    include: {
      user: { include: { profile: true } },
      images: { orderBy: { sortOrder: "asc" } }
    },
    take,
    orderBy
  });

  const mapped = await Promise.all(
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
        sect: m.sect,
        maritalStatus: m.maritalStatus,
        matchScore: rec != null ? Math.min(100, Math.round(rec.score)) : 0,
        bannerUrl: pickBannerUrl(m.images, m.user.profile),
        user: m.user
      };
    })
  );
  if (options?.sort === "score") {
    return mapped.sort((a, b) => b.matchScore - a.matchScore);
  }
  return mapped;
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
