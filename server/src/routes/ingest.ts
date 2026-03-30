import { Router } from "express";
import { z } from "zod";
import { ingestRawEmail } from "../services/ingestion.js";

export const ingestRouter = Router();

const bodySchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().optional(),
  rawBody: z.string().min(1),
  externalId: z.string().optional(),
});

ingestRouter.post("/email", async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const result = await ingestRawEmail(parsed.data);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
