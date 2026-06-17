import { Router } from "express";
import { buildPublicLanding } from "../../services/public-landing";
import { readAboutContent } from "../../services/site-about";
import { ok } from "../../utils/response";
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

export default router;
