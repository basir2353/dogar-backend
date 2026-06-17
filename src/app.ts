import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes";
import usersRoutes from "./modules/users/routes";
import matrimonialRoutes from "./modules/matrimonial/routes";
import communityRoutes from "./modules/community/routes";
import donationRoutes from "./modules/donations/routes";
import chatRoutes from "./modules/chat/routes";
import adminRoutes from "./modules/admin/routes";
import publicRoutes from "./modules/public/routes";
import { env, uploadDirAbs } from "./config/env";
import { corsOptions } from "./config/cors";
import { isDbUnavailable, serviceUnavailableMessage } from "./utils/db-availability";
import { fail, ok } from "./utils/response";
import cors from "cors";

export const app = express();

app.use(cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(uploadDirAbs));

app.get("/health", (_req, res) => {
  return res.json(ok({ service: "dogar-api", status: "healthy" }));
});

app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/matrimonial", matrimonialRoutes);
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/donations", donationRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((_req, res) => {
  return res.status(404).json(fail("NOT_FOUND", "Route not found"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isDbUnavailable(err)) {
    return res.status(503).json(fail("SERVICE_UNAVAILABLE", serviceUnavailableMessage(err)));
  }
  // eslint-disable-next-line no-console
  console.error(err);
  if (env.NODE_ENV === "development" && err instanceof Error) {
    return res.status(500).json(fail("INTERNAL_ERROR", err.message));
  }
  return res.status(500).json(fail("INTERNAL_ERROR", "An unexpected error occurred"));
});
