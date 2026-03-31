import { sendEmail } from "./email.js";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string): string {
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
}

export async function sendMail(input: SendMailInput): Promise<{ ok: boolean; reason?: string }> {
  if (!input.html && !input.text) {
    return { ok: false, reason: "empty_body" };
  }
  try {
    await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html ?? textToHtml(input.text),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown outbound send error";
    if (message.includes("RESEND_API_KEY is not configured")) {
      console.warn("[mail] Resend not configured — skipping send");
      return { ok: true, reason: "no_email_logged" };
    }
    console.error("[mail] Outbound send failed", { to: input.to, subject: input.subject, message });
    return { ok: false, reason: "email_send_failed" };
  }
}
