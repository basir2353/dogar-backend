import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Editable copy only (hero, CTAs, section titles). Profile/campaign/post lists come from the database.
 */
export type LandingCopy = {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaFindRishta: string;
  ctaCommunity: string;
  ctaDonate: string;
  howItWorksTitle: string;
  howItWorksSteps: string[];
  featuredProfilesTitle: string;
  donationImpactTitle: string;
  communityPreviewTitle: string;
};

const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.landing-content.json");

export const defaultLandingCopy: LandingCopy = {
  heroBadge: "Dogar Welfare Organization",
  heroTitle: "Building Trusted Families & Stronger Communities",
  heroSubtitle: "A premium hybrid platform for matrimonial discovery, social community growth, and verified welfare impact.",
  ctaFindRishta: "Find Rishta",
  ctaCommunity: "Join Community",
  ctaDonate: "Donate Now",
  howItWorksTitle: "How it works",
  howItWorksSteps: ["Create profile", "Find matches", "Connect safely"],
  featuredProfilesTitle: "Featured profiles",
  donationImpactTitle: "Donation impact",
  communityPreviewTitle: "Community"
};

/** @deprecated use defaultLandingCopy */
export const defaultLandingContent = defaultLandingCopy;
export type LandingContent = LandingCopy;

function pickCopyFromUnknown(raw: unknown): Partial<LandingCopy> {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const steps = o.howItWorksSteps;
  return {
    heroBadge: typeof o.heroBadge === "string" ? o.heroBadge : undefined,
    heroTitle: typeof o.heroTitle === "string" ? o.heroTitle : undefined,
    heroSubtitle: typeof o.heroSubtitle === "string" ? o.heroSubtitle : undefined,
    ctaFindRishta: typeof o.ctaFindRishta === "string" ? o.ctaFindRishta : undefined,
    ctaCommunity: typeof o.ctaCommunity === "string" ? o.ctaCommunity : undefined,
    ctaDonate: typeof o.ctaDonate === "string" ? o.ctaDonate : undefined,
    howItWorksTitle: typeof o.howItWorksTitle === "string" ? o.howItWorksTitle : undefined,
    howItWorksSteps: Array.isArray(steps) && steps.every((s) => typeof s === "string") ? (steps as string[]) : undefined,
    featuredProfilesTitle: typeof o.featuredProfilesTitle === "string" ? o.featuredProfilesTitle : undefined,
    donationImpactTitle: typeof o.donationImpactTitle === "string" ? o.donationImpactTitle : undefined,
    communityPreviewTitle: typeof o.communityPreviewTitle === "string" ? o.communityPreviewTitle : undefined
  };
}

export const readLandingContent = async (): Promise<LandingCopy> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const fromFile = pickCopyFromUnknown(parsed);
    return {
      ...defaultLandingCopy,
      ...fromFile
    };
  } catch {
    return { ...defaultLandingCopy };
  }
};

export const writeLandingContent = async (content: LandingCopy) => {
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
};
