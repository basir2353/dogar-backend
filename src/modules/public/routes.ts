import { Router } from "express";
import { buildPublicLanding } from "../../services/public-landing";
import {
  getPublicMatrimonialProfile,
  listPublicCommunityPosts,
  listPublicMatrimonialProfiles
} from "../../services/public-browse";
import { readAboutContent } from "../../services/site-about";
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

router.get("/community/posts", async (_req, res) => {
  try {
    const posts = await listPublicCommunityPosts();
    return res.json(ok(posts));
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
    const limitRaw = Number.parseInt(String(req.query.limit ?? "200"), 10);
    const limit = Number.isNaN(limitRaw) ? 200 : limitRaw;
    const profiles = await listPublicMatrimonialProfiles({ city, limit });
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

export default router;
