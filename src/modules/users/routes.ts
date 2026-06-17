import { Router } from "express";
import { z } from "zod";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { readLandingContent } from "../../config/landing-content";
import { buildPublicLanding } from "../../services/public-landing";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { isDbUnavailable, sendServiceUnavailable } from "../../utils/db-availability";
import { fail, ok } from "../../utils/response";

const router = Router();
const FALLBACK_PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala"
];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Separated"];
const RELIGION_OPTIONS = ["Islam", "Christianity", "Hinduism", "Sikhism", "Other"];
const SECT_OPTIONS = ["Sunni", "Shia", "Ahl-e-Hadith", "Barelvi", "Deobandi", "Other"];
const DEFAULT_CASTE_OPTIONS = ["Dogar", "Jutt", "Rajput", "Sheikh", "Arain"];

let cachedCities: string[] = [];
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const profileUpsertSchema = z.object({
  fullName: z.string().trim().min(2),
  city: z.string().trim().min(2),
  bio: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  age: z.union([z.string(), z.number()]).optional(),
  sect: z.string().optional(),
  profession: z.string().optional(),
  education: z.string().optional(),
  maritalStatus: z.string().optional(),
  monthlyIncome: z.string().optional(),
  fatherName: z.string().optional()
});
const fetchPakistanCities = async () => {
  const now = Date.now();
  if (cachedCities.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedCities;
  }

  try {
    if (env.CSC_API_KEY?.trim()) {
      const cscResponse = await fetch(`${env.CSC_API_BASE_URL}/countries/PK/cities`, {
        method: "GET",
        headers: {
          "X-CSCAPI-KEY": env.CSC_API_KEY
        }
      });
      if (cscResponse.ok) {
        const payload = (await cscResponse.json()) as Array<{ name?: string }>;
        const cscCities = (payload ?? [])
          .map((item) => (item.name ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        if (cscCities.length > 0) {
          cachedCities = cscCities;
          cachedAt = now;
          return cscCities;
        }
      }
    }

    const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "Pakistan" })
    });
    if (!response.ok) {
      throw new Error(`City API failed: ${response.status}`);
    }

    const payload = (await response.json()) as { data?: string[] };
    const cities = (payload.data ?? [])
      .map((city) => city.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (cities.length > 0) {
      cachedCities = cities;
      cachedAt = now;
      return cities;
    }
  } catch {
    // Fallback list is returned below.
  }

  return FALLBACK_PAKISTAN_CITIES;
};

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        profile: true,
        matrimonial: { include: { images: { orderBy: { sortOrder: "asc" } } } }
      }
    });

    if (!user) {
      return res.status(404).json(fail("NOT_FOUND", "User not found"));
    }

    return res.json(ok(user));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.get("/profile/options", requireAuth, async (_req: AuthRequest, res) => {
  const cities = await fetchPakistanCities();
  let castes = DEFAULT_CASTE_OPTIONS;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");
    const profileOptionsFilePath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../../.profile-options.json");
    const raw = await fs.readFile(profileOptionsFilePath, "utf-8");
    const parsed = JSON.parse(raw) as { castes?: string[] };
    if (Array.isArray(parsed.castes) && parsed.castes.length > 0) {
      castes = parsed.castes.map((item) => item.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }
  } catch {
    // Fall back to defaults when not configured.
  }
  return res.json(ok({
    country: "Pakistan",
    cities,
    maritalStatuses: MARITAL_STATUSES,
    religions: RELIGION_OPTIONS,
    sects: SECT_OPTIONS,
    castes
  }));
});

router.get("/landing-content", requireAuth, async (_req: AuthRequest, res) => {
  const content = await readLandingContent();
  return res.json(ok(content));
});

router.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  const parsed = profileUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid profile payload"));
  }

  const ageCandidate = Number(parsed.data.age);
  const normalizedAge = Number.isFinite(ageCandidate) && ageCandidate >= 18 && ageCandidate <= 80
    ? Math.round(ageCandidate)
    : null;

  try {
    const existing = await prisma.profile.findUnique({ where: { userId: req.user!.userId } });
    /** Admins can mark a profile VERIFIED; normal edits should not throw it back to the moderation queue. */
    const nextVerification: VerificationStatus =
      existing?.verificationStatus === VerificationStatus.VERIFIED
        ? VerificationStatus.VERIFIED
        : VerificationStatus.PENDING;

    const [profile, matrimonial] = await prisma.$transaction([
      prisma.profile.upsert({
        where: { userId: req.user!.userId },
        update: {
          fullName: parsed.data.fullName.trim(),
          city: parsed.data.city.trim(),
          bio: parsed.data.bio?.trim() || null,
          avatarUrl: parsed.data.profilePhotoUrl?.trim() || null,
          verificationStatus: nextVerification
        },
        create: {
          userId: req.user!.userId,
          fullName: parsed.data.fullName.trim(),
          city: parsed.data.city.trim(),
          bio: parsed.data.bio?.trim() || null,
          avatarUrl: parsed.data.profilePhotoUrl?.trim() || null
        }
      }),
      prisma.matrimonialProfile.upsert({
        where: { userId: req.user!.userId },
        update: {
          age: normalizedAge ?? 18,
          sect: parsed.data.sect?.trim() || null,
          profession: parsed.data.profession?.trim() || null,
          education: parsed.data.education?.trim() || null,
          maritalStatus: parsed.data.maritalStatus?.trim() || null,
          incomeRange: parsed.data.monthlyIncome?.trim() || null,
          aboutFamily: parsed.data.fatherName?.trim() || null
        },
        create: {
          userId: req.user!.userId,
          age: normalizedAge ?? 18,
          sect: parsed.data.sect?.trim() || null,
          profession: parsed.data.profession?.trim() || null,
          education: parsed.data.education?.trim() || null,
          maritalStatus: parsed.data.maritalStatus?.trim() || null,
          incomeRange: parsed.data.monthlyIncome?.trim() || null,
          aboutFamily: parsed.data.fatherName?.trim() || null
        }
      })
    ]);

    return res.json(ok({
      fullName: profile.fullName,
      city: profile.city,
      bio: profile.bio ?? "",
      profilePhotoUrl: profile.avatarUrl ?? "",
      age: matrimonial.age ? String(matrimonial.age) : "",
      sect: matrimonial.sect ?? "",
      profession: matrimonial.profession ?? "",
      education: matrimonial.education ?? "",
      maritalStatus: matrimonial.maritalStatus ?? "",
      monthlyIncome: matrimonial.incomeRange ?? "",
      fatherName: matrimonial.aboutFamily ?? ""
    }));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.get("/landing-content/public", async (_req, res) => {
  try {
    const payload = await buildPublicLanding();
    return res.json(ok(payload));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

export default router;
