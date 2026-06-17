export enum UserRole {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN"
}

export enum VerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED"
}

export enum CampaignStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  SUSPENDED = "SUSPENDED"
}

export enum InterestStatus {
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED"
}

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
};

export type JwtPayloadShape = {
  userId: string;
  role: UserRole;
  email: string;
};

/** Appended to community post `content` when the user adds a link (no extra DB column). */
export const COMMUNITY_POST_LINK_MARKER = "\n\n__LINK__\n" as const;

/** Public About page (CMS) — English source; client translates for ur/pa. */
export type AboutBlock = { id: string; title: string; body: string; imageUrl?: string; order: number };
export type AboutDeveloper = {
  sectionTitle: string;
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
  website?: string;
  email?: string;
};
export type AboutContent = {
  hero: { title: string; subtitle: string; imageUrl?: string };
  blocks: AboutBlock[];
  developer: AboutDeveloper;
};

/** Default About page when DB has no row or API read fails (must match server `site-about` defaults). */
export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  hero: {
    title: "About Dogar Welfare Trust",
    subtitle:
      "A trusted place for families: matrimonial search, community, and welfare — with transparency and care.",
    imageUrl: undefined
  },
  blocks: [
    {
      id: "mission",
      order: 0,
      title: "Our mission",
      body: "Dogar Welfare Trust works to strengthen families through honest matchmaking, a moderated community, and transparent welfare programs that donors and families can trust.",
      imageUrl: undefined
    },
    {
      id: "welfare",
      order: 1,
      title: "Verified welfare work",
      body: "We spotlight verified campaigns, track impact clearly, and keep the community safe through moderation and staff review.",
      imageUrl: undefined
    }
  ],
  developer: {
    sectionTitle: "Technical partner",
    name: "Platform team",
    role: "Product & engineering",
    bio: "The platform is built to keep your experience fast, private, and accessible on web and future channels.",
    imageUrl: undefined,
    website: undefined,
    email: undefined
  }
};

export const splitCommunityPostBodyAndLink = (stored: string): { body: string; linkUrl?: string } => {
  const marker = COMMUNITY_POST_LINK_MARKER;
  const idx = stored.lastIndexOf(marker);
  if (idx === -1) {
    return { body: stored };
  }
  const candidate = stored.slice(idx + marker.length).trim();
  if (!/^https?:\/\//i.test(candidate) && !/^mailto:/i.test(candidate)) {
    return { body: stored };
  }
  return { body: stored.slice(0, idx).trimEnd(), linkUrl: candidate };
};
