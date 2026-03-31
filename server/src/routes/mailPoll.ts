import { Router } from "express";
import { z } from "zod";
import { pollGmailOnce } from "../services/gmailIngest.js";
import { sendEmail } from "../services/email.js";

export const mailPollRouter = Router();

mailPollRouter.post("/gmail", async (_req, res, next) => {
  try {
    const r = await pollGmailOnce();
    res.json(r);
  } catch (e) {
    next(e);
  }
});

const sendTestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).default("Resend test email"),
  html: z.string().min(1).default("<p>Test email from Loan CRM.</p>"),
});

mailPollRouter.post("/test", async (req, res, next) => {
  try {
    const parsed = sendTestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    await sendEmail(parsed.data);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
