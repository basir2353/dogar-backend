import { UserRole } from "../../shared/index.js";
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { fail, ok } from "../../utils/response";

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  city: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8)
});

const signTokens = (payload: { userId: string; email: string; role: UserRole }) => {
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"] });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"] });
  return { accessToken, refreshToken };
};

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid registration payload"));
  }
  const { email, password, fullName, city } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json(fail("ALREADY_EXISTS", "Email already registered"));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: fullName.trim(),
          city: city.trim(),
          bio: "New member"
        }
      }
    }
  });

  const tokens = signTokens({ userId: user.id, email: user.email, role: user.role as UserRole });
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return res.status(201).json(ok({ userId: user.id, email: user.email, role: user.role, ...tokens }));
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid login payload"));
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json(fail("INVALID_CREDENTIALS", "Email or password is incorrect"));
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json(fail("INVALID_CREDENTIALS", "Email or password is incorrect"));
  }

  const tokens = signTokens({ userId: user.id, email: user.email, role: user.role as UserRole });
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return res.json(ok({ userId: user.id, email: user.email, role: user.role, ...tokens }));
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined;
  if (!refreshToken) {
    return res.status(400).json(fail("VALIDATION_ERROR", "refreshToken is required"));
  }

  const session = await prisma.userSession.findUnique({ where: { refreshToken } });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    return res.status(401).json(fail("UNAUTHORIZED", "Refresh token invalid or expired"));
  }

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string; email: string; role: UserRole };
    const tokens = signTokens({ userId: payload.userId, email: payload.email, role: payload.role });
    await prisma.userSession.update({
      where: { refreshToken },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    return res.json(ok(tokens));
  } catch {
    return res.status(401).json(fail("UNAUTHORIZED", "Refresh token invalid"));
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined;
  if (refreshToken) {
    await prisma.userSession.deleteMany({ where: { refreshToken, userId: req.user?.userId } });
  }
  return res.json(ok({ loggedOut: true }));
});

router.post("/otp", (_req, res) => {
  return res.json(ok({ step: "otp-dispatched", message: "OTP workflow placeholder for SMS/Email integration." }));
});

export default router;
