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
export type AboutAward = {
  id: string;
  title: string;
  year?: string;
  description: string;
  imageUrl?: string;
  order: number;
};
export type AboutDocument = {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  category: "award" | "registration" | "certificate" | "sodo" | "other";
  order: number;
};
export type AboutDeveloper = {
  sectionTitle: string;
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
  website?: string;
  email?: string;
};
export type AboutStat = { id: string; label: string; value: string; order: number };
export type AboutTimeline = { id: string; year: string; title: string; body: string; order: number };
export type AboutTeamMember = { id: string; name: string; role: string; bio?: string; imageUrl?: string; order: number };
export type AboutFaq = { id: string; question: string; answer: string; order: number };
export type AboutContact = {
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  mapEmbedUrl?: string;
};
export type AboutTestimonial = { id: string; name: string; role?: string; quote: string; imageUrl?: string; order: number };
export type AboutGalleryImage = { id: string; imageUrl: string; caption?: string; order: number };
export type AboutPartner = { id: string; name: string; logoUrl?: string; order: number };
export type AboutContent = {
  hero: { title: string; subtitle: string; imageUrl?: string };
  blocks: AboutBlock[];
  awards: AboutAward[];
  documents: AboutDocument[];
  developer: AboutDeveloper;
  stats: AboutStat[];
  timeline: AboutTimeline[];
  team: AboutTeamMember[];
  faq: AboutFaq[];
  contact: AboutContact;
  testimonials: AboutTestimonial[];
  gallery: AboutGalleryImage[];
  partners: AboutPartner[];
  videoUrl?: string;
};

export const COMMUNITY_REACTION_TYPES = ["like", "love", "support", "celebrate"] as const;
export type CommunityReactionType = (typeof COMMUNITY_REACTION_TYPES)[number];

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
  awards: [
    {
      id: "award-community",
      order: 0,
      title: "Community service recognition",
      year: "2024",
      description: "Honoured for transparent welfare work and family support programs across Punjab.",
      imageUrl: undefined
    }
  ],
  documents: [
    {
      id: "doc-registration",
      order: 0,
      title: "Trust registration certificate",
      description: "Official registration document for Dogar Welfare Trust.",
      fileUrl: "",
      category: "registration"
    },
    {
      id: "doc-sodo",
      order: 1,
      title: "SODO / society documents",
      description: "Society registration and compliance records available for verification.",
      fileUrl: "",
      category: "sodo"
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
  },
  stats: [
    { id: "s1", order: 0, label: "Verified members", value: "500+" },
    { id: "s2", order: 1, label: "Welfare campaigns", value: "25+" },
    { id: "s3", order: 2, label: "Families helped", value: "1,200+" },
    { id: "s4", order: 3, label: "Years of service", value: "10+" }
  ],
  timeline: [
    { id: "t1", order: 0, year: "2015", title: "Trust founded", body: "Dogar Welfare Trust began supporting families with welfare and community programs." },
    { id: "t2", order: 1, year: "2020", title: "Digital platform", body: "Launched online rishta and community features for wider reach." },
    { id: "t3", order: 2, year: "2024", title: "Verified network", body: "Expanded verified profiles, SODO transparency, and donation tracking." }
  ],
  team: [
    { id: "tm1", order: 0, name: "Trust leadership", role: "Chairperson", bio: "Oversees welfare programs and community standards." },
    { id: "tm2", order: 1, name: "Community moderator", role: "Moderation lead", bio: "Keeps the community safe and respectful." }
  ],
  faq: [
    { id: "f1", order: 0, question: "How are rishta profiles verified?", answer: "Every profile is reviewed by our moderation team before it appears publicly." },
    { id: "f2", order: 1, question: "Where can I see trust documents?", answer: "Awards, registration, and SODO documents are listed on this About page." },
    { id: "f3", order: 2, question: "How do donations work?", answer: "Active campaigns show raised amounts and goals on the Donations page." }
  ],
  contact: {
    address: "Lahore, Punjab, Pakistan",
    phone: "+92 300 0000000",
    whatsapp: "+92 300 0000000",
    email: "info@dogar.org",
    facebook: "https://facebook.com",
    instagram: "https://instagram.com"
  },
  testimonials: [
    { id: "r1", order: 0, name: "Family from Lahore", role: "Member", quote: "We found a respectful match and transparent welfare support through Dogar." },
    { id: "r2", order: 1, name: "Donor", role: "Supporter", quote: "Campaign updates are clear — we know where help goes." }
  ],
  gallery: [],
  partners: [
    { id: "p1", order: 0, name: "Local welfare partners" },
    { id: "p2", order: 1, name: "Community volunteers" }
  ],
  videoUrl: undefined
};

/** Extract unique hashtags from post text (lowercase, without #). */
export const extractHashtags = (text: string): string[] => {
  const matches = text.match(/#([\w\u0600-\u06FF]+)/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const tag = raw.slice(1).toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
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
