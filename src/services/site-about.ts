import type { AboutContent } from "../shared/index.js";
import { DEFAULT_ABOUT_CONTENT } from "../shared/index.js";
import { z } from "zod";
import { prisma } from "../config/prisma";

const ordered = <T extends z.ZodTypeAny>(schema: T, max: number) =>
  z.array(schema).max(max).default([]);

const aboutBlockZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(20_000),
  imageUrl: z.string().max(2000).optional(),
  order: z.number().int()
});

const aboutAwardZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  year: z.string().max(20).optional(),
  description: z.string().min(1).max(5_000),
  imageUrl: z.string().max(2000).optional(),
  order: z.number().int()
});

const aboutDocumentZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(5_000).optional(),
  fileUrl: z.string().max(2000),
  category: z.enum(["award", "registration", "certificate", "sodo", "other"]),
  order: z.number().int()
});

const aboutDeveloperZ = z.object({
  sectionTitle: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  bio: z.string().min(1).max(10_000),
  imageUrl: z.string().max(2000).optional(),
  website: z.string().max(2000).optional(),
  email: z.string().max(200).optional()
});

const aboutStatZ = z.object({ id: z.string(), label: z.string().max(200), value: z.string().max(100), order: z.number().int() });
const aboutTimelineZ = z.object({ id: z.string(), year: z.string().max(20), title: z.string().max(500), body: z.string().max(5000), order: z.number().int() });
const aboutTeamZ = z.object({ id: z.string(), name: z.string().max(200), role: z.string().max(200), bio: z.string().max(3000).optional(), imageUrl: z.string().max(2000).optional(), order: z.number().int() });
const aboutFaqZ = z.object({ id: z.string(), question: z.string().max(500), answer: z.string().max(5000), order: z.number().int() });
const aboutContactZ = z.object({
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  whatsapp: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  facebook: z.string().max(500).optional(),
  instagram: z.string().max(500).optional(),
  mapEmbedUrl: z.string().max(2000).optional()
}).default({});
const aboutTestimonialZ = z.object({ id: z.string(), name: z.string().max(200), role: z.string().max(200).optional(), quote: z.string().max(3000), imageUrl: z.string().max(2000).optional(), order: z.number().int() });
const aboutGalleryZ = z.object({ id: z.string(), imageUrl: z.string().max(2000), caption: z.string().max(500).optional(), order: z.number().int() });
const aboutPartnerZ = z.object({ id: z.string(), name: z.string().max(200), logoUrl: z.string().max(2000).optional(), order: z.number().int() });

const aboutContentZ = z.object({
  hero: z.object({
    title: z.string().min(1).max(500),
    subtitle: z.string().min(1).max(10_000),
    imageUrl: z.string().max(2000).optional()
  }),
  blocks: z.array(aboutBlockZ).min(1).max(12),
  awards: ordered(aboutAwardZ, 20),
  documents: ordered(aboutDocumentZ, 30),
  developer: aboutDeveloperZ,
  stats: ordered(aboutStatZ, 12),
  timeline: ordered(aboutTimelineZ, 20),
  team: ordered(aboutTeamZ, 20),
  faq: ordered(aboutFaqZ, 30),
  contact: aboutContactZ,
  testimonials: ordered(aboutTestimonialZ, 20),
  gallery: ordered(aboutGalleryZ, 40),
  partners: ordered(aboutPartnerZ, 20),
  videoUrl: z.string().max(2000).optional()
});

const SINGLETON_ID = "default";

export const defaultAboutContent: AboutContent = DEFAULT_ABOUT_CONTENT;

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function mergeOrdered<T extends { order: number }>(partial: T[] | undefined, defaults: T[]): T[] {
  const src = partial?.length ? partial : defaults;
  return sortByOrder(src.map((item, i) => ({ ...item, order: typeof item.order === "number" ? item.order : i })));
}

export function mergeAbout(partial: Partial<AboutContent> | null | undefined, base: AboutContent = defaultAboutContent): AboutContent {
  if (!partial) {
    return {
      ...DEFAULT_ABOUT_CONTENT,
      blocks: sortByOrder([...DEFAULT_ABOUT_CONTENT.blocks]),
      awards: sortByOrder([...DEFAULT_ABOUT_CONTENT.awards]),
      documents: sortByOrder([...DEFAULT_ABOUT_CONTENT.documents]),
      stats: sortByOrder([...DEFAULT_ABOUT_CONTENT.stats]),
      timeline: sortByOrder([...DEFAULT_ABOUT_CONTENT.timeline]),
      team: sortByOrder([...DEFAULT_ABOUT_CONTENT.team]),
      faq: sortByOrder([...DEFAULT_ABOUT_CONTENT.faq]),
      contact: { ...DEFAULT_ABOUT_CONTENT.contact },
      testimonials: sortByOrder([...DEFAULT_ABOUT_CONTENT.testimonials]),
      gallery: sortByOrder([...DEFAULT_ABOUT_CONTENT.gallery]),
      partners: sortByOrder([...DEFAULT_ABOUT_CONTENT.partners]),
      videoUrl: DEFAULT_ABOUT_CONTENT.videoUrl
    };
  }
  return {
    hero: { ...base.hero, ...partial.hero },
    blocks: mergeOrdered(partial.blocks, defaultAboutContent.blocks),
    awards: mergeOrdered(partial.awards, defaultAboutContent.awards),
    documents: mergeOrdered(partial.documents, defaultAboutContent.documents),
    developer: { ...base.developer, ...partial.developer },
    stats: mergeOrdered(partial.stats, defaultAboutContent.stats),
    timeline: mergeOrdered(partial.timeline, defaultAboutContent.timeline),
    team: mergeOrdered(partial.team, defaultAboutContent.team),
    faq: mergeOrdered(partial.faq, defaultAboutContent.faq),
    contact: { ...base.contact, ...partial.contact },
    testimonials: mergeOrdered(partial.testimonials, defaultAboutContent.testimonials),
    gallery: mergeOrdered(partial.gallery, defaultAboutContent.gallery),
    partners: mergeOrdered(partial.partners, defaultAboutContent.partners),
    videoUrl: partial.videoUrl ?? base.videoUrl
  };
}

export async function readAboutContent(): Promise<AboutContent> {
  const fallback = (): AboutContent => mergeAbout(null);
  try {
    const row = await prisma.siteAbout.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      return fallback();
    }
    const raw = aboutContentZ.safeParse(row.content);
    if (raw.success) {
      return mergeAbout(raw.data);
    }
    return mergeAbout(row.content as Partial<AboutContent>);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[site-about] readAboutContent falling back to defaults:", err);
    }
    return fallback();
  }
}

export function parseAboutPayload(input: unknown): { ok: true; data: AboutContent } | { ok: false; error: string } {
  const parsed = aboutContentZ.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: mergeAbout(parsed.data) };
  }
  return { ok: false, error: parsed.error.flatten().formErrors.join("; ") || "Invalid about content" };
}

export async function writeAboutContent(data: AboutContent) {
  const merged = mergeAbout(data);
  const validated = aboutContentZ.safeParse(merged);
  if (!validated.success) {
    throw new Error("Invalid about content");
  }
  await prisma.siteAbout.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      content: validated.data as object
    },
    update: { content: validated.data as object }
  });
  return readAboutContent();
}
