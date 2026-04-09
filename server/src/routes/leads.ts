import { Router } from "express";
import { z } from "zod";
import {
  archiveLead,
  findLeadById,
  listLeadsForCsvExport,
  listLeadsWithSummary,
  setStuck,
  updateLeadNotes,
  updateLeadStatus,
} from "../services/leadRepo.js";
import { listEmailsForLead } from "../services/emailRepo.js";
import { listFollowUpsForLead } from "../services/followUpRepo.js";
import type { LeadStatus } from "../types.js";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { cancelScheduledFollowUps } from "../services/followUpQueue.js";

export const leadsRouter = Router();

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

leadsRouter.get("/export/csv", async (_req, res, next) => {
  try {
    const rows = await listLeadsForCsvExport();
    const header = [
      "name",
      "email",
      "phone",
      "property_address",
      "status",
      "created_at",
      "clicked_at",
      "archived",
      "archived_at",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvEscape(r.name),
          csvEscape(r.email),
          csvEscape(r.phone),
          csvEscape(r.property_address),
          csvEscape(r.status),
          csvEscape(r.created_at?.toISOString?.() ?? r.created_at),
          csvEscape(r.clicked_at ? r.clicked_at.toISOString() : ""),
          csvEscape(r.archived),
          csvEscape(r.archived_at ? r.archived_at.toISOString() : ""),
        ].join(",")
      ),
    ];
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
    return res.status(200).send(lines.join("\n"));
  } catch (e) {
    next(e);
  }
});

leadsRouter.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as LeadStatus | undefined;
    const includeArchived = String(req.query.includeArchived ?? "").toLowerCase() === "true";
    const sortParam = req.query.sort;
    const sort =
      sortParam === "score"
        ? "score"
        : sortParam === "created"
          ? "created"
          : sortParam === "activity"
            ? "activity"
            : "created";
    const leads = await listLeadsWithSummary({ status, sort, includeArchived });
    const { rows: stuckIds } = await pool.query<{ id: string }>(
      `SELECT id FROM leads
       WHERE status IN ('CONTACTED','FOLLOW_UP')
         AND updated_at < now() - interval '7 days'`
    );
    const stuckSet = new Set(stuckIds.map((r) => r.id));
    const staleDays = 5;
    const enriched = leads.map((l) => {
      let stale_no_reply = false;
      if (l.awaiting_reply && l.last_outbound_email_at) {
        const days =
          (Date.now() - new Date(l.last_outbound_email_at).getTime()) / (24 * 60 * 60 * 1000);
        stale_no_reply = days >= staleDays;
      }
      return {
        ...l,
        stuck_suggestion: stuckSet.has(l.id) || l.is_stuck,
        stale_no_reply,
      };
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ leads: enriched });
  } catch (e) {
    next(e);
  }
});

leadsRouter.get("/:id/emails", async (req, res, next) => {
  try {
    const lead = await findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });
    const emails = await listEmailsForLead(lead.id, 100);
    res.json({ emails });
  } catch (e) {
    next(e);
  }
});

leadsRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });
    const [emails, follow_ups] = await Promise.all([
      listEmailsForLead(lead.id, 200),
      listFollowUpsForLead(lead.id),
    ]);
    const base = config.apiPublicUrl.replace(/\/$/, "");
    const tracked_redirect_url = `${base}/r/${lead.redirect_token}`;
    res.json({ lead, emails, follow_ups, tracked_redirect_url });
  } catch (e) {
    next(e);
  }
});

const patchSchema = z.object({
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "FOLLOW_UP",
      "ENGAGED",
      "OPTED_OUT",
    ])
    .optional(),
  is_stuck: z.boolean().optional(),
});

const notesPatchSchema = z.object({
  notes: z.string().max(5000),
});

leadsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const lead = await findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });
    if (parsed.data.status) await updateLeadStatus(lead.id, parsed.data.status);
    if (parsed.data.is_stuck !== undefined) await setStuck(lead.id, parsed.data.is_stuck);
    const nextLead = await findLeadById(lead.id);
    res.json({ lead: nextLead });
  } catch (e) {
    next(e);
  }
});

leadsRouter.patch("/:id/notes", async (req, res, _next) => {
  try {
    const parsed = notesPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const lead = await findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });
    const normalized = parsed.data.notes.trim();
    await updateLeadNotes(lead.id, normalized);
    const nextLead = await findLeadById(lead.id);
    return res.json({ lead: nextLead });
  } catch (e) {
    console.error("[leads] notes update failed", e);
    return res.status(500).json({ error: "Failed to update notes" });
  }
});

leadsRouter.patch("/:id/archive", async (req, res, next) => {
  try {
    const lead = await findLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Not found" });
    await archiveLead(lead.id);
    await cancelScheduledFollowUps(lead.id);
    const nextLead = await findLeadById(lead.id);
    res.json({ lead: nextLead });
  } catch (e) {
    next(e);
  }
});
