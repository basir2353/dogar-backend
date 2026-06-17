import type cors from "cors";
import { env, getAllowedOrigins, isOriginAllowed } from "./env";

export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true
};

export const socketCorsOrigin =
  env.NODE_ENV === "production"
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        callback(null, isOriginAllowed(origin));
      }
    : true;

if (env.NODE_ENV === "production" && getAllowedOrigins().length === 0) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api] FRONTEND_URL / ALLOWED_ORIGINS not set — CORS allows all origins in production. Set FRONTEND_URL on Railway."
  );
}
