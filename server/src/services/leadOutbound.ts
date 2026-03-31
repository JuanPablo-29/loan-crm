import type { LeadRow } from "../types.js";
import { config } from "../config.js";
import { countOutboundLast24h, insertEmail } from "./emailRepo.js";
import { setLastOutbound } from "./leadRepo.js";
import { sendMail } from "./outboundMail.js";
import { pool } from "../db/pool.js";

function unsubscribeFooter(lead: LeadRow): string {
  return `\n\n—\nPrefer not to receive these messages? Reply STOP to opt out.`;
}

function firstNameFromLead(lead: LeadRow): string {
  const raw = (lead.name ?? "").trim();
  if (!raw) return "there";
  const token = raw.split(/\s+/)[0] ?? "";
  return token.replace(/[^a-zA-Z'-]/g, "") || "there";
}

function locationFromPropertyAddress(lead: LeadRow): string | null {
  const raw = (lead.property_address ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return parts[0] ?? null;
}

function buildKariBrandedBody(lead: LeadRow): string {
  const firstName = firstNameFromLead(lead);
  const location = locationFromPropertyAddress(lead);
  if (location) {
    return `Hello ${firstName},

I am a preferred lender with Realtor.com. My name is Kari and I see you are looking at properties in ${location}. Kindly please call me to discuss how Novus Home Mortgage may assist you with your pre-approval.

Warm regards,

Kari Pastrana`;
  }
  return `Hello ${firstName},

I am a preferred lender with Realtor.com. My name is Kari and I'd love to connect with you to discuss how Novus Home Mortgage may assist you with your pre-approval.

Warm regards,

Kari Pastrana`;
}

/** Use API_PUBLIC_URL: `GET /r/:token` is served by Express, not Next.js on APP_BASE_URL. */
function trackedApplicationLink(lead: LeadRow): string {
  const base = config.apiPublicUrl.replace(/\/$/, "");
  return `${base}/r/${lead.redirect_token}`;
}

export async function canSendToLead(lead: LeadRow): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (lead.status === "OPTED_OUT") return { ok: false, reason: "opted_out" };
  const n = await countOutboundLast24h(lead.id);
  if (n >= config.maxEmailsPerLeadPerDay) return { ok: false, reason: "daily_cap" };
  if (lead.last_outbound_at) {
    const diffMin = (Date.now() - new Date(lead.last_outbound_at).getTime()) / 60000;
    if (diffMin < config.minMinutesBetweenSends) return { ok: false, reason: "throttle" };
  }
  return { ok: true };
}

export type SendToLeadInput = {
  lead: LeadRow;
  subject: string;
  body: string;
  templateKey: string;
  dedupKey: string;
  skipFooter?: boolean;
  includeTrackedLink?: boolean;
};

export async function sendToLead(input: SendToLeadInput): Promise<{ ok: boolean; reason?: string }> {
  const gate = await canSendToLead(input.lead);
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const dup = await pool.query(`SELECT 1 FROM send_dedup WHERE lead_id = $1 AND dedup_key = $2`, [
    input.lead.id,
    input.dedupKey,
  ]);
  if (dup.rowCount && dup.rowCount > 0) return { ok: false, reason: "duplicate" };

  const trackedLink = trackedApplicationLink(input.lead);
  const cta = input.includeTrackedLink === false ? "" : `\n\nApplication link: ${trackedLink}`;
  const brandedBody =
    input.templateKey === "ai_reply" || input.templateKey.startsWith("followup_")
      ? buildKariBrandedBody(input.lead)
      : input.body;
  const text = input.skipFooter
    ? `${brandedBody}${cta}`
    : `${brandedBody}${cta}${unsubscribeFooter(input.lead)}`;

  const mail = await sendMail({
    to: input.lead.email,
    subject: input.subject,
    text,
  });

  if (!mail.ok && mail.reason !== "no_email_logged") return mail;

  await insertEmail({
    lead_id: input.lead.id,
    direction: "OUTBOUND",
    subject: input.subject,
    body_text: text,
    template_key: input.templateKey,
    metadata: { smtp: mail.reason === "no_email_logged" ? "skipped_dev" : "sent" },
  });

  await setLastOutbound(input.lead.id);
  await pool.query(`INSERT INTO send_dedup (lead_id, dedup_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    input.lead.id,
    input.dedupKey,
  ]);

  return { ok: true };
}
