import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const envPath = path.resolve(currentDir, "../../.env");
// Production (Railway): use platform env vars only. Local dev: load backend/.env
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: envPath, override: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  ACCESS_TOKEN_TTL: z.string().default("7d"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  UPLOAD_DIR: z.string().default("./uploads"),
  /** `local` (default) or `s3` when object storage is wired up. */
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  CSC_API_KEY: z.string().optional(),
  CSC_API_BASE_URL: z.string().default("https://api.countrystatecity.in/v1"),
  /** Primary web app origin — no trailing path (e.g. https://app.vercel.app). */
  FRONTEND_URL: z.string().optional(),
  /** Extra CORS/Socket.IO origins, comma-separated (preview URLs, staging). */
  ALLOWED_ORIGINS: z.string().optional(),
  /** When true, allow any `https://*.vercel.app` origin (preview deployments). */
  ALLOW_VERCEL_PREVIEWS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true")
});

export const env = envSchema.parse(process.env);

const apiRoot = path.resolve(currentDir, "../..");
export const uploadDirAbs = path.isAbsolute(env.UPLOAD_DIR)
  ? path.normalize(env.UPLOAD_DIR)
  : path.resolve(apiRoot, env.UPLOAD_DIR);

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "").trim();
}

/** Origins allowed for CORS and Socket.IO. */
export function getAllowedOrigins(): string[] {
  const set = new Set<string>();
  if (env.FRONTEND_URL) {
    set.add(normalizeOrigin(env.FRONTEND_URL));
  }
  if (env.ALLOWED_ORIGINS) {
    for (const part of env.ALLOWED_ORIGINS.split(",")) {
      const o = normalizeOrigin(part);
      if (o) set.add(o);
    }
  }
  return [...set];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    return true;
  }
  if (allowed.includes(normalized)) return true;
  if (env.ALLOW_VERCEL_PREVIEWS && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized)) {
    return true;
  }
  return false;
}

if (env.NODE_ENV === "development") {
  const raw = process.env.DATABASE_URL;
  if (raw) {
    const m = raw.match(/^postgres(ql)?:\/\/([^:]+):[^@]+@([^/]+)\/([^?]+)/i);
    if (m) {
      // eslint-disable-next-line no-console
      console.log(`[api] DATABASE → user "${m[2]}" @ ${m[3]} / "${m[4]}"  (read from: ${envPath})`);
    }
  }
}
