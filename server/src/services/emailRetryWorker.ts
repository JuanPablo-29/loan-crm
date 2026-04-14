import { pool } from "../db/pool.js";
import { isQuotaOrRateLimitError, sendEmail } from "./email.js";

type FailedEmailRow = {
  id: number;
  to_email: string;
  subject: string | null;
  html: string | null;
  text: string | null;
  error: string | null;
  error_type: string | null;
  status: string;
  retry_count: number;
  next_retry_at: Date;
  created_at: Date;
};

/** After this many failed retry attempts, row is marked `failed` (initial send failure uses retry_count 0). */
const MAX_RETRY_ATTEMPTS = 10;

let timer: NodeJS.Timeout | null = null;

export async function retryFailedEmails(): Promise<void> {
  const { rows: idRows } = await pool.query<{ id: number }>(
    `SELECT id FROM failed_emails
     WHERE status = 'pending' AND next_retry_at <= NOW()
     ORDER BY id ASC
     LIMIT 20`
  );

  for (const { id } of idRows) {
    const claim = await pool.query<FailedEmailRow>(
      `UPDATE failed_emails SET status = 'retrying' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (!claim.rows[0]) continue;
    const row = claim.rows[0];
    console.log("Retrying failed email:", row.id);

    if (!row.html?.trim()) {
      const errMsg = [row.error, "[retry] missing html body"].filter(Boolean).join("\n");
      await pool.query(`UPDATE failed_emails SET status = 'failed', error = $1 WHERE id = $2`, [
        errMsg,
        row.id,
      ]);
      continue;
    }

    const sent = await sendEmail(
      {
        to: row.to_email,
        subject: row.subject ?? "",
        html: row.html,
        textForRecord: row.text,
      },
      { skipFailedQueue: true }
    );

    if (sent.ok) {
      await pool.query(`UPDATE failed_emails SET status = 'sent' WHERE id = $1`, [row.id]);
      continue;
    }

    const retryCount = row.retry_count + 1;
    const detail = sent.error ?? "delivery failed";
    const combinedError = [row.error, `[retry ${retryCount}] ${detail}`].filter(Boolean).join("\n");
    const stillQuota =
      row.error_type === "quota" || isQuotaOrRateLimitError(detail) || isQuotaOrRateLimitError(row.error);
    const nextErrorType = stillQuota ? "quota" : "generic";

    if (retryCount > MAX_RETRY_ATTEMPTS) {
      await pool.query(
        `UPDATE failed_emails SET status = 'failed', retry_count = $1, error = $2, error_type = $3 WHERE id = $4`,
        [retryCount, combinedError, nextErrorType, row.id]
      );
    } else if (stillQuota) {
      console.warn("Quota hit, delaying retry:", row.id);
      await pool.query(
        `UPDATE failed_emails
         SET status = 'pending',
             retry_count = $1,
             next_retry_at = NOW() + INTERVAL '24 hours',
             error = $2,
             error_type = $3
         WHERE id = $4`,
        [retryCount, combinedError, nextErrorType, row.id]
      );
    } else {
      const backoffMinutes = retryCount * 10;
      await pool.query(
        `UPDATE failed_emails
         SET status = 'pending',
             retry_count = $1,
             next_retry_at = NOW() + ($2::int * INTERVAL '1 minute'),
             error = $3,
             error_type = $4
         WHERE id = $5`,
        [retryCount, backoffMinutes, combinedError, nextErrorType, row.id]
      );
    }
  }
}

export function startEmailRetryScheduler(): void {
  const intervalMs = 10 * 60 * 1000;
  void retryFailedEmails().catch((err) => console.error("[email-retry] initial run failed", err));
  timer = setInterval(() => {
    void retryFailedEmails().catch((err) => console.error("[email-retry] tick failed", err));
  }, intervalMs);
  console.log("[email-retry] scheduler started (10 min interval)");
}

export function stopEmailRetryScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
