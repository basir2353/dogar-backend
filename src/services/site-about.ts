import type { AboutContent, AboutBlock, AboutDeveloper } from "../shared/index.js";
import { DEFAULT_ABOUT_CONTENT } from "../shared/index.js";
import { z } from "zod";
import { prisma } from "../config/prisma";

const aboutBlockZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(20_000),
  imageUrl: z.string().max(2000).optional(),
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

const aboutContentZ = z.object({
  hero: z.object({
    title: z.string().min(1).max(500),
    subtitle: z.string().min(1).max(10_000),
    imageUrl: z.string().max(2000).optional()
  }),
  blocks: z.array(aboutBlockZ).min(1).max(12),
  developer: aboutDeveloperZ
});

const SINGLETON_ID = "default";

export const defaultAboutContent: AboutContent = DEFAULT_ABOUT_CONTENT;

function sortBlocks(b: AboutBlock[]) {
  return [...b].sort((a, b) => a.order - b.order);
}

export function mergeAbout(partial: Partial<AboutContent> | null | undefined, base: AboutContent = defaultAboutContent): AboutContent {
  if (!partial) return { ...defaultAboutContent, blocks: sortBlocks(defaultAboutContent.blocks) };
  const blocks = (partial.blocks?.length ? partial.blocks : defaultAboutContent.blocks).map((b, i) => ({
    ...b,
    order: typeof b.order === "number" ? b.order : i
  }));
  return {
    hero: { ...base.hero, ...partial.hero },
    blocks: sortBlocks(blocks),
    developer: { ...base.developer, ...partial.developer }
  };
}

export async function readAboutContent(): Promise<AboutContent> {
  const fallback = (): AboutContent => ({
    ...DEFAULT_ABOUT_CONTENT,
    blocks: sortBlocks([...DEFAULT_ABOUT_CONTENT.blocks])
  });
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
    // Table missing (migration not run), DB down, Prisma client mismatch, etc.
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
