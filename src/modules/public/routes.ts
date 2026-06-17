import { Router } from "express";
import { buildPublicLanding } from "../../services/public-landing";
import {
  getPublicMatrimonialProfile,
  listPublicCommunityPosts,
  listPublicMatrimonialProfiles,
  listPublicTrendingHashtags
} from "../../services/public-browse";
import { readAboutContent } from "../../services/site-about";
import { createContactMessage, contactSubmitSchema } from "../../services/contact-messages";
import { fail, ok } from "../../utils/response";
import { isDbUnavailable, sendServiceUnavailable } from "../../utils/db-availability";

const router = Router();

router.get("/landing", async (_req, res) => {
  try {
    const payload = await buildPublicLanding();
    return res.json(ok(payload));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.get("/about", async (_req, res) => {
  try {
    const data = await readAboutContent();
    return res.json(ok(data));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.get("/community/posts", async (req, res) => {
  try {
    const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
    const hashtag = typeof req.query.hashtag === "string" ? req.query.hashtag : undefined;
    const posts = await listPublicCommunityPosts({ sort, hashtag });
    return res.json(ok(posts));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.get("/community/hashtags/trending", async (_req, res) => {
  try {
    const tags = await listPublicTrendingHashtags();
    return res.json(ok(tags));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.get("/matrimonial/profiles", async (req, res) => {
  try {
    const cityRaw = req.query.city;
    const city = typeof cityRaw === "string" && cityRaw.trim() ? cityRaw.trim() : undefined;
    const ageMinRaw = Number.parseInt(String(req.query.ageMin ?? ""), 10);
    const ageMaxRaw = Number.parseInt(String(req.query.ageMax ?? ""), 10);
    const professionRaw = req.query.profession;
    const profession = typeof professionRaw === "string" && professionRaw.trim() ? professionRaw.trim() : undefined;
    const sectRaw = req.query.sect;
    const sect = typeof sectRaw === "string" && sectRaw.trim() ? sectRaw.trim() : undefined;
    const educationRaw = req.query.education;
    const education = typeof educationRaw === "string" && educationRaw.trim() ? educationRaw.trim() : undefined;
    const maritalRaw = req.query.maritalStatus;
    const maritalStatus = typeof maritalRaw === "string" && maritalRaw.trim() ? maritalRaw.trim() : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;
    const limitRaw = Number.parseInt(String(req.query.limit ?? "200"), 10);
    const limit = Number.isNaN(limitRaw) ? 200 : limitRaw;
    const profiles = await listPublicMatrimonialProfiles({
      city,
      ageMin: Number.isNaN(ageMinRaw) ? undefined : ageMinRaw,
      ageMax: Number.isNaN(ageMaxRaw) ? undefined : ageMaxRaw,
      profession,
      sect,
      education,
      maritalStatus,
      sort,
      limit
    });
    return res.json(ok(profiles));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.get("/matrimonial/profile/:userId", async (req, res) => {
  try {
    const profile = await getPublicMatrimonialProfile(String(req.params.userId));
    if (!profile) {
      return res.status(404).json(fail("NOT_FOUND", "Profile not found"));
    }
    return res.json(ok(profile));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

router.post("/contact", async (req, res) => {
  try {
    const parsed = contactSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid contact form";
      return res.status(400).json(fail("VALIDATION_ERROR", first));
    }
    const row = await createContactMessage(parsed.data);
    return res.status(201).json(ok({ id: row.id, message: "Thank you. We received your message and will respond soon." }));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    throw error;
  }
});

export default router;
