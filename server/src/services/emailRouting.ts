import type { LeadRow } from "../types.js";

function normalizeRecipientEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Alerts for leads without a reachable address — must never be LOAN_OFFICER_EMAIL. */
export function getNoEmailManualForwardRecipient(): string | null {
  const fb = normalizeRecipientEmail(process.env.NO_EMAIL_FALLBACK);
  if (!fb || !fb.includes("@")) {
    console.error("[email-routing] NO_EMAIL_FALLBACK is missing or invalid; cannot send no-email lead alert");
    return null;
  }
  const officer = normalizeRecipientEmail(process.env.LOAN_OFFICER_EMAIL);
  if (officer && fb === officer) {
    console.error("[email-routing] NO_EMAIL_FALLBACK must not equal LOAN_OFFICER_EMAIL");
    return null;
  }
  return fb;
}

/**
 * Single source of truth for CRM outbound recipient: lead inbox, or NO_EMAIL_FALLBACK — never LOAN_OFFICER_EMAIL.
 */
export function getSafeRecipient(lead: Pick<LeadRow, "email">): string | null {
  const loanOfficerEmail = normalizeRecipientEmail(process.env.LOAN_OFFICER_EMAIL);
  let fallbackEmail = normalizeRecipientEmail(process.env.NO_EMAIL_FALLBACK);
  if (fallbackEmail && loanOfficerEmail && fallbackEmail === loanOfficerEmail) {
    console.error("[email-routing] NO_EMAIL_FALLBACK must not equal LOAN_OFFICER_EMAIL; treating as unset");
    fallbackEmail = "";
  }

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

/** Hard stop before any Resend call — prevents regressions. */
export function assertNotLoanOfficerOutboundRecipient(to: string): void {
  const t = normalizeRecipientEmail(to);
  const officer = normalizeRecipientEmail(process.env.LOAN_OFFICER_EMAIL);
  if (officer && t === officer) {
    throw new Error("CRITICAL: Attempted to send email to loan officer");
  }
}
