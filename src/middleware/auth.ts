import { UserRole, type JwtPayloadShape } from "../shared/index.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { fail } from "../utils/response";

export type AuthRequest = Request & {
  user?: JwtPayloadShape;
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json(fail("UNAUTHORIZED", "Missing access token"));
  }

  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayloadShape;
    return next();
  } catch {
    return res.status(401).json(fail("UNAUTHORIZED", "Invalid or expired access token"));
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json(fail("FORBIDDEN", "You are not allowed to perform this action"));
    }

    return next();
  };
};
