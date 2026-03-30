import { Router } from "express";
import { pollGmailOnce } from "../services/gmailIngest.js";

export const mailPollRouter = Router();

mailPollRouter.post("/gmail", async (_req, res, next) => {
  try {
    const r = await pollGmailOnce();
    res.json(r);
  } catch (e) {
    next(e);
  }
});
