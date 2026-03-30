import { pool } from "../db/pool.js";
import type { EmailRow } from "../types.js";

export async function insertEmail(input: {
  lead_id: string;
  direction: "INBOUND" | "OUTBOUND";
  subject?: string | null;
  body_text: string;
  external_id?: string | null;
  template_key?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<EmailRow> {
  const { rows } = await pool.query<EmailRow>(
    `INSERT INTO emails (lead_id, direction, subject, body_text, external_id, template_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
    [
      input.lead_id,
      input.direction,
      input.subject ?? null,
      input.body_text,
      input.external_id ?? null,
      input.template_key ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return rows[0];
}

export async function listEmailsForLead(leadId: string, limit = 50): Promise<EmailRow[]> {
  const { rows } = await pool.query<EmailRow>(
    `SELECT * FROM emails WHERE lead_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [leadId, limit]
  );
  return rows;
}

export async function countOutboundLast24h(leadId: string): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM emails
     WHERE lead_id = $1 AND direction = 'OUTBOUND' AND created_at > now() - interval '24 hours'`,
    [leadId]
  );
  return Number(rows[0]?.c ?? 0);
}

export async function hasLeadRepliedAfterLastOutbound(leadId: string): Promise<boolean> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c
     FROM emails
     WHERE lead_id = $1
       AND direction = 'INBOUND'
       AND created_at > COALESCE(
         (SELECT last_outbound_at FROM leads WHERE id = $1),
         to_timestamp(0)
       )`,
    [leadId]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}
