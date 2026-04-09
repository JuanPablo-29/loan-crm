import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { findLeadById } from "./leadRepo.js";
import { sendToLead } from "./leadOutbound.js";
import { hasLeadRepliedAfterLastOutbound } from "./emailRepo.js";
import { generatePersonalizedOutboundEmail } from "./aiAgent.js";
import { listEmailsForLead } from "./emailRepo.js";

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export const FOLLOW_UP_QUEUE = "follow-up";

export const followUpQueue = new Queue(FOLLOW_UP_QUEUE, { connection });

export type FollowUpJob = { leadId: string; sequenceDay: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function scheduleFollowUpsForLead(leadId: string, from: Date): Promise<void> {
  const lead = await findLeadById(leadId);
  if (!lead || lead.archived) return;

  const { rows: existing } = await pool.query(`SELECT 1 FROM follow_ups WHERE lead_id = $1 LIMIT 1`, [
    leadId,
  ]);
  if (existing.length > 0) return;

  const sequences = [1, 3, 7] as const;
  for (const day of sequences) {
    const scheduledFor = new Date(from.getTime() + day * DAY_MS);
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    const job = await followUpQueue.add(
      "reminder",
      { leadId, sequenceDay: day } satisfies FollowUpJob,
      { delay, jobId: `${leadId}:fu:${day}`, removeOnComplete: true }
    );
    await pool.query(
      `INSERT INTO follow_ups (lead_id, sequence_day, scheduled_for, bullmq_job_id, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [leadId, day, scheduledFor, job.id]
    );
  }
}

export async function cancelScheduledFollowUps(leadId: string): Promise<void> {
  const { rows } = await pool.query<{ bullmq_job_id: string | null }>(
    `SELECT bullmq_job_id FROM follow_ups WHERE lead_id = $1 AND status = 'PENDING'`,
    [leadId]
  );
  for (const r of rows) {
    if (r.bullmq_job_id) {
      const job = await followUpQueue.getJob(r.bullmq_job_id);
      await job?.remove();
    }
  }
  await pool.query(`UPDATE follow_ups SET status = 'CANCELLED' WHERE lead_id = $1 AND status = 'PENDING'`, [
    leadId,
  ]);
}

async function processFollowUp(job: Job<FollowUpJob>): Promise<void> {
  const { leadId, sequenceDay } = job.data;
  const lead = await findLeadById(leadId);
  if (!lead) return;
  if (lead.archived) {
    await pool.query(
      `UPDATE follow_ups SET status = 'CANCELLED' WHERE lead_id = $1 AND sequence_day = $2 AND status = 'PENDING'`,
      [leadId, sequenceDay]
    );
    return;
  }
  if (lead.status === "OPTED_OUT" || lead.status === "ENGAGED") return;
  if (lead.clicked_at || lead.engaged_at) return;
  if (await hasLeadRepliedAfterLastOutbound(leadId)) return;

  const subjectHints: Record<number, string> = {
    1: "Quick reminder from your loan officer",
    3: "Following up on your loan inquiry",
    7: "Final follow-up — happy to help",
  };
  const thread = await listEmailsForLead(lead.id, 40);
  const aiDraft = await generatePersonalizedOutboundEmail({
    lead,
    thread,
    objective: `Send day-${sequenceDay} follow-up tailored to this lead. Encourage a brief reply with their timeline and goals.`,
    subjectHint: subjectHints[sequenceDay] ?? "Loan follow-up",
  });

  const result = await sendToLead({
    lead,
    subject: aiDraft.subject,
    body: aiDraft.body,
    templateKey: `followup_d${sequenceDay}`,
    dedupKey: `followup:${leadId}:${sequenceDay}:${job.id}`,
  });

  if (result.ok) {
    await pool.query(
      `UPDATE follow_ups SET status = 'SENT' WHERE lead_id = $1 AND sequence_day = $2 AND status = 'PENDING'`,
      [leadId, sequenceDay]
    );
    await pool.query(
      `UPDATE leads SET status = CASE WHEN status IN ('NEW','CONTACTED') THEN 'FOLLOW_UP' ELSE status END, updated_at = now() WHERE id = $1 AND status != 'ENGAGED'`,
      [leadId]
    );
  }
}

export function startFollowUpWorker(): Worker<FollowUpJob> {
  return new Worker<FollowUpJob>(
    FOLLOW_UP_QUEUE,
    async (job) => {
      await processFollowUp(job);
    },
    { connection }
  );
}
