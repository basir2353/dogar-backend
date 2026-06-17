import { VerificationStatus, CampaignStatus } from "@prisma/client";
import { pickBannerUrl } from "../lib/matrimonial-media";
import { readLandingContent } from "../config/landing-content";
import { prisma } from "../config/prisma";

export type FeaturedProfileItem = {
  name: string;
  age: number;
  city: string;
  score: number;
  bannerUrl: string | null;
};
export type FeaturedCampaignItem = { title: string; raised: number; goal: number; verified: boolean };
export type CommunityPreviewItem = { author: string; content: string; likes: number; comments: number };

/**
 * Real-time landing payload: copy from file + live profiles, campaigns, and posts from the database.
 */
export async function buildPublicLanding() {
  const copy = await readLandingContent();

  const matrimonialRows = await prisma.matrimonialProfile.findMany({
    where: { user: { profile: { verificationStatus: VerificationStatus.VERIFIED } } },
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: { user: { include: { profile: true } }, images: { orderBy: { sortOrder: "asc" } } }
  });

  const featuredProfiles: FeaturedProfileItem[] = await Promise.all(
    matrimonialRows.map(async (m) => {
      const rec = await prisma.matchRecommendation.findFirst({
        where: { recommendedUserId: m.userId },
        orderBy: { score: "desc" }
      });
      return {
        name: m.user.profile?.fullName?.trim() || "Member",
        age: m.age,
        city: m.user.profile?.city?.trim() || "",
        score: rec != null ? Math.min(100, Math.round(rec.score)) : 0,
        bannerUrl: pickBannerUrl(m.images, m.user.profile)
      };
    })
  );

  const campaignRows = await prisma.campaign.findMany({
    where: { status: CampaignStatus.ACTIVE },
    take: 8,
    orderBy: { createdAt: "desc" }
  });

  const featuredCampaigns: FeaturedCampaignItem[] = campaignRows.map((c) => ({
    title: c.title,
    raised: c.raisedAmount,
    goal: c.goalAmount,
    verified: c.isVerified
  }));

  const postRows = await prisma.communityPost.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    include: {
      author: { include: { profile: true } },
      _count: { select: { likes: true, comments: true } }
    }
  });

  const communityPreviewPosts: CommunityPreviewItem[] = postRows.map((p) => {
    const body = p.content.trim();
    const preview = body.length > 220 ? `${body.slice(0, 220)}…` : body;
    return {
      author: p.author.profile?.fullName?.trim() || p.author.email,
      content: preview,
      likes: p._count.likes,
      comments: p._count.comments
    };
  });

  return {
    copy,
    featuredProfiles,
    featuredCampaigns,
    communityPreviewPosts
  };
}
