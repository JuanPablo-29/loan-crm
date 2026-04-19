import type { LeadRow } from "../types.js";

function normalizeRecipientEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizedIngestInbox(): string {
  return normalizeRecipientEmail(process.env.INGEST_INBOX_EMAIL);
}

/**
 * Normalized `NO_EMAIL_FALLBACK` when set and valid, or `null` when unset/invalid
 * or when it would equal the Gmail ingest inbox (loop risk).
 */
function resolveNoEmailFallbackRecipient(): string | null {
  const fb = normalizeRecipientEmail(process.env.NO_EMAIL_FALLBACK);
  if (!fb || !fb.includes("@")) {
    return null;
  }
  const ingest = normalizedIngestInbox();
  if (ingest && fb === ingest) {
    console.warn("[email-routing] NO_EMAIL_FALLBACK matches ingest inbox; blocked to prevent loops");
    return null;
  }
  return fb;
}

/** Alerts for leads without a reachable address — uses `NO_EMAIL_FALLBACK` unless it matches the ingest inbox. */
export function getNoEmailManualForwardRecipient(): string | null {
  const resolved = resolveNoEmailFallbackRecipient();
  if (!resolved) {
    console.error("[email-routing] NO_EMAIL_FALLBACK is missing, invalid, or blocked; cannot send no-email lead alert");
    return null;
  }
  return resolved;
}

/**
 * CRM outbound recipient: lead inbox when valid, else `NO_EMAIL_FALLBACK` if configured and safe.
 * `NO_EMAIL_FALLBACK` may equal `LOAN_OFFICER_EMAIL` unless it matches `INGEST_INBOX_EMAIL` (loop risk).
 */
export function getSafeRecipient(lead: Pick<LeadRow, "email">): string | null {
  const loanOfficerEmail = normalizeRecipientEmail(process.env.LOAN_OFFICER_EMAIL);
  const fallbackEmail = resolveNoEmailFallbackRecipient() ?? "";

  const useFallback = (): string | null => {
    if (fallbackEmail && fallbackEmail.includes("@")) return fallbackEmail;
    return null;
  };

  const email = normalizeRecipientEmail(lead.email);

  let final: string | null;
  if (!email || !email.includes("@") || email.endsWith("@invalid.local")) {
    final = useFallback();
  } else if (loanOfficerEmail && email === loanOfficerEmail) {
    console.error("[email-routing] Blocked send to loan officer email for lead", { email: lead.email });
    final = useFallback();
  } else {
    final = email;
  }

  console.log("[email-routing] EMAIL ROUTING", { leadEmail: lead.email, finalRecipient: final });
  return final;
}

/**
 * Hard stop before Resend — blocks accidental CRM sends to the loan officer inbox
 * except when that address is explicitly the configured no-email fallback (and not ingest-blocked).
 */
export function assertNotLoanOfficerOutboundRecipient(to: string): void {
  const t = normalizeRecipientEmail(to);
  const officer = normalizeRecipientEmail(process.env.LOAN_OFFICER_EMAIL);
  if (!officer || t !== officer) return;

  const allowedFallback = resolveNoEmailFallbackRecipient();
  if (allowedFallback && t === allowedFallback) return;

  throw new Error("CRITICAL: Attempted to send email to loan officer");
}
