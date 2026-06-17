import { Router } from "express";
import { z } from "zod";
import { CampaignStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { isDbUnavailable, sendServiceUnavailable } from "../../utils/db-availability";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { fail, ok } from "../../utils/response";

const router = Router();

router.get("/campaigns", async (_req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: CampaignStatus.ACTIVE },
      orderBy: { createdAt: "desc" }
    });
    return res.json(ok(campaigns));
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

router.post("/campaigns/:id/donate", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({
    amount: z.coerce.number().positive().max(50_000_000),
    message: z.string().max(2_000).optional()
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(fail("VALIDATION_ERROR", "Invalid donation payload"));
  }

  const campaignId = String(req.params.id);

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(403).json(
        fail("SESSION_INVALID", "Your session is not valid for this action. Please sign in again with a full account.")
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, status: CampaignStatus.ACTIVE }
    });
    if (!campaign) {
      return res
        .status(404)
        .json(fail("CAMPAIGN_NOT_FOUND", "Campaign not found or not available for donations."));
    }

    const donation = await prisma.$transaction(async (tx) => {
      const created = await tx.donation.create({
        data: {
          userId: req.user!.userId,
          campaignId,
          amount: parsed.data.amount,
          message: parsed.data.message
        }
      });

      await tx.campaign.update({
        where: { id: campaignId },
        data: { raisedAmount: { increment: parsed.data.amount } }
      });

      return created;
    });

    return res.status(201).json(ok(donation));
  } catch (error) {
    if (isDbUnavailable(error)) {
      return sendServiceUnavailable(res);
    }
    const message = error instanceof Error ? error.message : "Unable to record donation";
    return res.status(500).json(fail("DONATION_FAILED", message));
  }
});

router.get("/impact", async (_req, res) => {
  try {
    const [funds, donors, campaigns] = await Promise.all([
      prisma.donation.aggregate({ _sum: { amount: true } }),
      prisma.donation.groupBy({ by: ["userId"] }),
      prisma.campaign.count({ where: { status: CampaignStatus.ACTIVE } })
    ]);

    return res.json(
      ok({
        totalRaised: funds._sum.amount ?? 0,
        activeCampaigns: campaigns,
        uniqueDonors: donors.length
      })
    );
  } catch (error) {
    if (!isDbUnavailable(error)) {
      throw error;
    }
    return sendServiceUnavailable(res);
  }
});

export default router;
