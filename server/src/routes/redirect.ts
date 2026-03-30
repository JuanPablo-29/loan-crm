import { Router } from "express";
import { config } from "../config.js";
import { cancelScheduledFollowUps } from "../services/followUpQueue.js";
import { findLeadByRedirectToken, markLeadClicked } from "../services/leadRepo.js";

export const redirectRouter = Router();

redirectRouter.get("/:token", async (req, res, next) => {
  try {
    const lead = await findLeadByRedirectToken(req.params.token);
    if (!lead) return res.status(404).send("Not found");
    await markLeadClicked(lead.id);
    await cancelScheduledFollowUps(lead.id);
    return res.redirect(302, config.externalApplicationUrl);
  } catch (e) {
    next(e);
  }
});
