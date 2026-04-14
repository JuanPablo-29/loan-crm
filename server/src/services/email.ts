import { Resend } from "resend";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { buildEmailSignatureHtml } from "../utils/emailSignature.js";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Stored on failed_emails for debugging / optional future replay as text. */
  textForRecord?: string | null;
};

export type SendEmailResult = { ok: true } | { ok: false; error?: string };

export type SendEmailOptions = {
  /** When true, delivery failures are not inserted into failed_emails (used by retry worker). */
  skipFailedQueue?: boolean;
};

/** True when Resend (or transport) indicates quota / rate limiting — used for retry backoff. */
export function isQuotaOrRateLimitError(message: string | null | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("too many requests")
  );
}

/** Next calendar day at 09:00 local time (first quota failure scheduling). */
export function computeNextQuotaRetryAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function deliverViaResend(input: SendEmailInput): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const resend = getResendClient();
    const htmlWithSignature = `${input.html}${buildEmailSignatureHtml()}`;
    const result = await resend.emails.send({
      from: config.emailFrom,
      to: input.to,
      subject: input.subject,
      html: htmlWithSignature,
    });
    if (result.error) {
      return { ok: false, message: `Resend API error: ${result.error.message}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email send error";
    return { ok: false, message };
  }
}

export async function sendEmail(
  input: SendEmailInput,
  options?: SendEmailOptions
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const delivery = await deliverViaResend(input);
  if (delivery.ok) {
    return { ok: true };
  }

  const failResult: SendEmailResult = { ok: false, error: delivery.message };

  console.error("[email] Send failed", {
    to: input.to,
    subject: input.subject,
    message: delivery.message,
  });

  if (!options?.skipFailedQueue) {
    const errorType = isQuotaOrRateLimitError(delivery.message) ? "quota" : "generic";
    const nextRetryAt = errorType === "quota" ? computeNextQuotaRetryAt() : new Date();
    try {
      await pool.query(
        `INSERT INTO failed_emails (to_email, subject, html, text, error, error_type, status, retry_count, next_retry_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, $7)`,
        [
          input.to,
          input.subject ?? null,
          input.html,
          input.textForRecord ?? null,
          delivery.message,
          errorType,
          nextRetryAt,
        ]
      );
      if (errorType === "quota") {
        console.warn("[email] Quota / rate limit hit; first retry scheduled for next local day ~9:00", {
          to: input.to,
        });
      }
    } catch (dbErr) {
      console.error("[email] failed_emails insert failed", dbErr);
    }
  }

  return failResult;
}
