import type { Profile } from "@prisma/client";

export const MAX_MATRIMONIAL_IMAGES = 5;

type ImageRow = { url: string; isBanner: boolean };

export function pickBannerUrl(
  images: ImageRow[],
  profile: Pick<Profile, "avatarUrl"> | null
): string | null {
  const byBanner = images.find((i) => i.isBanner);
  if (byBanner) {
    return byBanner.url;
  }
  if (images.length > 0) {
    return images[0].url;
  }
  return profile?.avatarUrl ?? null;
}
