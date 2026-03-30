import { pool } from "../db/pool.js";

export type FollowUpRow = {
  id: string;
  lead_id: string;
  sequence_day: number;
  scheduled_for: Date;
  bullmq_job_id: string | null;
  status: "PENDING" | "SENT" | "CANCELLED" | "SKIPPED";
  created_at: Date;
};

export async function listFollowUpsForLead(leadId: string): Promise<FollowUpRow[]> {
  const { rows } = await pool.query<FollowUpRow>(
    `SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY sequence_day ASC`,
    [leadId]
  );
  return rows;
}
