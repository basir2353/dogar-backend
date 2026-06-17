import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const envPath = path.resolve(currentDir, "../../.env");
// `override: true` so values in backend/.env win over Windows/user environment variables.
// Otherwise an old system-level DATABASE_URL can make .env edits look "ignored" and P1000 keeps recurring.
dotenv.config({ path: envPath, override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  /** Short-lived = more secure; long = fewer logouts if the app does not refresh. Default 7d to match common “stay signed in a week” expectation. */
  ACCESS_TOKEN_TTL: z.string().default("7d"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  UPLOAD_DIR: z.string().default("./uploads"),
  CSC_API_KEY: z.string().optional(),
  CSC_API_BASE_URL: z.string().default("https://api.countrystatecity.in/v1"),
  /** Production: set to your web app origin, no trailing path (e.g. https://app.example.com). CORS and Socket.IO use this. */
  FRONTEND_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);

/** Resolves `UPLOAD_DIR` from the @dogar/api package root so file uploads match `express.static` when cwd is the monorepo root. */
const apiRoot = path.resolve(currentDir, "../..");
export const uploadDirAbs = path.isAbsolute(env.UPLOAD_DIR)
  ? path.normalize(env.UPLOAD_DIR)
  : path.resolve(apiRoot, env.UPLOAD_DIR);

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
