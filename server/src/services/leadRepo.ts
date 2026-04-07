import type { LeadRow, LeadStatus } from "../types.js";
import { pool } from "../db/pool.js";
import { generateRedirectToken } from "../utils/tokens.js";

export async function findLeadById(id: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findLeadByEmail(email: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findLeadByRedirectToken(token: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT * FROM leads WHERE redirect_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

export type LeadListItem = LeadRow & {
  pending_follow_up_count: number;
  last_outbound_email_at: Date | null;
  awaiting_reply: boolean;
};

const LIST_ORDER: Record<"updated" | "score" | "created" | "activity", string> = {
  updated: "l.updated_at DESC, l.created_at DESC",
  score: "l.lead_score DESC, l.updated_at DESC",
  created: "l.created_at DESC",
  activity: "COALESCE(ob.last_out, l.updated_at, l.created_at) DESC",
};

export async function listLeadsWithSummary(filters: {
  status?: LeadStatus;
  sort?: keyof typeof LIST_ORDER;
  includeArchived?: boolean;
}): Promise<LeadListItem[]> {
  const order = LIST_ORDER[filters.sort ?? "updated"];
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filters.includeArchived) where.push("(l.archived = false OR l.archived IS NULL)");
  if (filters.status) {
    params.push(filters.status);
    where.push(`l.status = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query<LeadListItem>(
    `SELECT l.*,
      COALESCE(fu.pending_cnt, 0)::int AS pending_follow_up_count,
      ob.last_out AS last_outbound_email_at,
      (ob.last_out IS NOT NULL AND NOT COALESCE(inb.has_reply_after, false)) AS awaiting_reply
    FROM leads l
    LEFT JOIN (
      SELECT lead_id, COUNT(*)::int AS pending_cnt
      FROM follow_ups WHERE status = 'PENDING' GROUP BY lead_id
    ) fu ON fu.lead_id = l.id
    LEFT JOIN (
      SELECT lead_id, MAX(created_at) AS last_out
      FROM emails WHERE direction = 'OUTBOUND' GROUP BY lead_id
    ) ob ON ob.lead_id = l.id
    LEFT JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1 FROM emails ei
        WHERE ei.lead_id = l.id AND ei.direction = 'INBOUND'
          AND ob.last_out IS NOT NULL AND ei.created_at > ob.last_out
      ) AS has_reply_after
    ) inb ON true
    ${whereClause}
    ORDER BY ${order}`,
    params
  );
  return rows;
}

export type LeadCsvExportRow = Pick<
  LeadRow,
  | "name"
  | "email"
  | "phone"
  | "property_address"
  | "status"
  | "created_at"
  | "clicked_at"
  | "archived"
  | "archived_at"
>;

export async function listLeadsForCsvExport(): Promise<LeadCsvExportRow[]> {
  const { rows } = await pool.query<LeadCsvExportRow>(
    `SELECT name, email, phone, property_address, status, created_at, clicked_at, archived, archived_at
     FROM leads
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function createLead(input: {
  name?: string | null;
  email: string;
  phone?: string | null;
  property_address?: string | null;
  notes?: string | null;
  intent?: string | null;
  lead_score?: number;
}): Promise<LeadRow> {
  const score = input.lead_score ?? inferScoreFromIntent(input.intent);
  const redirectToken = generateRedirectToken();
  const { rows } = await pool.query<LeadRow>(
    `INSERT INTO leads (name, email, phone, property_address, notes, intent, lead_score, redirect_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, leads.name),
       phone = COALESCE(EXCLUDED.phone, leads.phone),
       property_address = COALESCE(leads.property_address, EXCLUDED.property_address),
       notes = COALESCE(leads.notes, EXCLUDED.notes),
       intent = COALESCE(EXCLUDED.intent, leads.intent),
       lead_score = GREATEST(leads.lead_score, EXCLUDED.lead_score),
       redirect_token = COALESCE(leads.redirect_token, EXCLUDED.redirect_token),
       updated_at = now()
     RETURNING *`,
    [
      input.name ?? null,
      input.email.trim().toLowerCase(),
      input.phone ?? null,
      input.property_address ?? null,
      input.notes ?? null,
      input.intent ?? null,
      score,
      redirectToken,
    ]
  );
  return rows[0];
}

export async function setLeadPropertyAddressIfMissing(
  id: string,
  propertyAddress: string | null | undefined
): Promise<void> {
  const normalized = propertyAddress?.trim();
  if (!normalized) return;
  await pool.query(
    `UPDATE leads
     SET property_address = $2,
         updated_at = now()
     WHERE id = $1
       AND (property_address IS NULL OR btrim(property_address) = '')`,
    [id, normalized]
  );
}

function inferScoreFromIntent(intent: string | null | undefined): number {
  if (!intent) return 50;
  const t = intent.toLowerCase();
  if (/ready|apply|urgent|asap|today|now|pre-?approved|high/i.test(t)) return 85;
  if (/interested|loan|mortgage|refinance|rate/i.test(t)) return 70;
  if (/question|info|curious/i.test(t)) return 55;
  return 50;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  await pool.query(
    `UPDATE leads SET status = $2, updated_at = now() WHERE id = $1`,
    [id, status]
  );
}

export async function markOptOut(id: string): Promise<void> {
  await pool.query(
    `UPDATE leads SET status = 'OPTED_OUT', opted_out_at = now(), updated_at = now() WHERE id = $1`,
    [id]
  );
}

export async function touchEngagement(id: string): Promise<void> {
  await pool.query(
    `UPDATE leads SET engagement_started_at = COALESCE(engagement_started_at, now()), updated_at = now() WHERE id = $1`,
    [id]
  );
}

export async function setLastOutbound(id: string): Promise<void> {
  await pool.query(
    `UPDATE leads SET last_outbound_at = now(), updated_at = now() WHERE id = $1`,
    [id]
  );
}

export async function setStuck(id: string, stuck: boolean): Promise<void> {
  await pool.query(`UPDATE leads SET is_stuck = $2, updated_at = now() WHERE id = $1`, [
    id,
    stuck,
  ]);
}

export async function archiveLead(id: string): Promise<void> {
  await pool.query(
    `UPDATE leads
     SET archived = true,
         archived_at = COALESCE(archived_at, now()),
         updated_at = now()
     WHERE id = $1`,
    [id]
  );
}

export async function updateLeadNotes(id: string, notes: string): Promise<void> {
  await pool.query(
    `UPDATE leads
     SET notes = $2,
         updated_at = now()
     WHERE id = $1`,
    [id, notes]
  );
}

export async function markLeadClicked(id: string): Promise<void> {
  await pool.query(
    `UPDATE leads
     SET clicked_at = COALESCE(clicked_at, now()),
         engaged_at = COALESCE(engaged_at, now()),
         status = CASE WHEN status = 'OPTED_OUT' THEN status ELSE 'ENGAGED' END,
         updated_at = now()
     WHERE id = $1`,
    [id]
  );
}
