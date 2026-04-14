import {
  createLead,
  findLeadByEmail,
  findLeadById,
  markOptOut,
  setLeadPropertyAddressIfMissing,
  touchEngagement,
  updateLeadStatus,
} from "./leadRepo.js";
import { insertEmail, listEmailsForLead } from "./emailRepo.js";
import { extractLeadFieldsFromEmail, generatePersonalizedOutboundEmail } from "./aiAgent.js";
import { emailComplianceFooter, sendToLead } from "./leadOutbound.js";
import { sendMail } from "./outboundMail.js";
import { scheduleFollowUpsForLead, cancelScheduledFollowUps } from "./followUpQueue.js";

const OPT_OUT_RE = /\b(stop|unsubscribe|opt\s*out|remove\s+me|do\s+not\s+contact|cancel)\b/i;
const AI_EXTRACTION_PROMPT_MAX_CHARS = 2000;

const OPT_OUT_MAX_WORDS = 300;

/** Markers that usually start quoted / forwarded content (earliest wins). */
const FORWARD_MARKERS = [
  "\nFrom:",
  "\r\nFrom:",
  "\nSent:",
  "\r\nSent:",
  "\nSubject:",
  "\r\nSubject:",
  "\nTo:",
  "\r\nTo:",
  "\nCc:",
  "\r\nCc:",
  "\n-----Original Message-----",
  "\r\n-----Original Message-----",
  "\nBegin forwarded message:",
  "\r\nBegin forwarded message:",
  "Forwarded message",
  "Original Message",
] as const;

const SIGNATURE_MARKERS = [
  "\n--\n",
  "\n-- \n",
  "\r\n--\r\n",
  "\nBest regards",
  "\nWarm regards",
  "\nKind regards",
  "\nThanks,",
  "\nThank you,",
  "\nSent from my iPhone",
  "\nSent from my Android",
] as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function stripForwardedThread(body: string): string {
  let cutoff = body.length;
  const lower = body.toLowerCase();
  for (const marker of FORWARD_MARKERS) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1 && idx < cutoff) cutoff = idx;
  }
  return body.slice(0, cutoff).trimEnd();
}

export function stripSignature(body: string): string {
  let cutoff = body.length;
  const lower = body.toLowerCase();
  for (const marker of SIGNATURE_MARKERS) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1 && idx < cutoff) cutoff = idx;
  }
  return body.slice(0, cutoff).trimEnd();
}

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** True if cleaned body contains a direct opt-out request (use after forward/signature stripping). */
export function isOptOutMessage(body: string): boolean {
  return OPT_OUT_RE.test(body);
}

/** @deprecated Prefer isOptOutMessage on cleaned body + sender guard; kept for callers/tests. */
export function bodyRequestsOptOut(text: string): boolean {
  return isOptOutMessage(stripSignature(stripForwardedThread(text)));
}

function shouldTreatInboundAsLeadOptOut(fromEmail: string, leadEmail: string, rawBody: string): boolean {
  if (normalizeEmail(fromEmail) !== normalizeEmail(leadEmail)) return false;
  const cleaned = stripSignature(stripForwardedThread(rawBody));
  if (wordCount(cleaned) > OPT_OUT_MAX_WORDS) return false;
  return isOptOutMessage(cleaned);
}

type RelevantLeadData = {
  name: string | null;
  phone: string | null;
  price: string | null;
  location: string | null;
  message: string | null;
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Parse large raw/HTML lead emails down to the fields we need for AI extraction/personalization. */
export function extractRelevantLeadData(raw: string): RelevantLeadData {
  if (!raw) {
    return { name: null, phone: null, price: null, location: null, message: null };
  }

  const text = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  const nameMatch = text.match(/New Prospect\s+([A-Za-z][A-Za-z'-]*)/i);
  const phoneMatch = text.match(/\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
  const priceMatch = text.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
  const locationMatch = text.match(/\b([A-Za-z][A-Za-z\s.'-]+,\s?[A-Z]{2},?\s?\d{5}(?:-\d{4})?)\b/);
  const messageMatch = text.match(/Customer Message[:\s]*([\s\S]*?)(?:Called|Phone|Email|Best Regards|Thank you|$)/i);

  return {
    name: nameMatch?.[1] ?? null,
    phone: phoneMatch?.[0] ?? null,
    price: priceMatch?.[0] ?? null,
    location: locationMatch?.[1] ?? null,
    message: messageMatch?.[1]?.trim() ?? null,
  };
}

function buildAiExtractionPrompt(input: {
  fromEmail: string;
  subject?: string;
  extracted: RelevantLeadData;
}): string {
  const customerMessage = input.extracted.message
    ? truncate(input.extracted.message, 700)
    : `No direct customer message provided. Use only name/location context:
Name: ${input.extracted.name || "there"}
Location: ${input.extracted.location || "unknown"}`;

  const prompt = `You are extracting structured data for a mortgage CRM. Return valid JSON only with keys:
name, email, phone, property_address, budget, notes, intent, lead_score_hint.

Context:
From: ${input.fromEmail}
Subject: ${input.subject ?? ""}
Name: ${input.extracted.name || "there"}
Phone: ${input.extracted.phone || "unknown"}
Location: ${input.extracted.location || "unknown"}
Budget: ${input.extracted.price || "unknown"}

Customer Message:
${customerMessage}

Rules:
- Do not invent missing fields.
- Keep budget as text.
- lead_score_hint must be numeric when possible, otherwise null.
- Ignore signatures, legal disclaimers, links, and HTML markup.`;

  return truncate(prompt, AI_EXTRACTION_PROMPT_MAX_CHARS);
}

export async function ingestRawEmail(input: {
  rawBody: string;
  subject?: string;
  fromEmail: string;
  fromName?: string | null;
  externalId?: string | null;
}): Promise<{ leadId: string; optedOut: boolean; replied: boolean }> {
  const relevantLead = extractRelevantLeadData(input.rawBody);
  console.log("[ingest] Extracted Lead:", relevantLead);
  const extractionPrompt = buildAiExtractionPrompt({
    fromEmail: input.fromEmail,
    subject: input.subject,
    extracted: relevantLead,
  });
  const extracted = await extractLeadFieldsFromEmail(extractionPrompt);
  const email = (extracted.email ?? input.fromEmail).trim().toLowerCase();
  let lead = await findLeadByEmail(email);
  if (!lead) {
    lead = await createLead({
      name: extracted.name ?? input.fromName ?? null,
      email,
      phone: extracted.phone,
      property_address: extracted.property_address,
      notes: extracted.notes,
      intent: extracted.intent,
      lead_score: extracted.lead_score_hint ?? undefined,
    });
  }

  await insertEmail({
    lead_id: lead.id,
    direction: "INBOUND",
    subject: input.subject ?? null,
    body_text: input.rawBody,
    external_id: input.externalId ?? null,
    metadata: { from: input.fromEmail },
  });

  let current = await findLeadById(lead.id);
  if (!current) throw new Error("Lead missing after create");
  await setLeadPropertyAddressIfMissing(current.id, extracted.property_address);
  current = await findLeadById(lead.id);
  if (!current) throw new Error("Lead missing after property update");

  if (shouldTreatInboundAsLeadOptOut(input.fromEmail, current.email, input.rawBody)) {
    await markOptOut(current.id);
    await cancelScheduledFollowUps(current.id);
    const ack =
      "We've removed you from automated follow-ups. If you need help in the future, you can reach us anytime.";
    const ackBody = `${ack}${emailComplianceFooter(current)}`;
    await sendMail({
      to: current.email,
      subject: "You are unsubscribed",
      text: ackBody,
    });
    await insertEmail({
      lead_id: current.id,
      direction: "OUTBOUND",
      subject: "You are unsubscribed",
      body_text: ackBody,
      template_key: "opt_out_confirm",
      metadata: { bypass_gate: true },
    });
    return { leadId: current.id, optedOut: true, replied: true };
  }

  const thread = await listEmailsForLead(current.id, 40);
  const aiDraft = await generatePersonalizedOutboundEmail({
    lead: current,
    thread,
    objective:
      "Reply to the lead's latest message with tailored guidance and move them toward the next pre-approval step.",
    subjectHint: input.subject ?? "Your loan inquiry",
  });
  const subjBase = aiDraft.subject || input.subject || "Your loan inquiry";
  const subj = subjBase.startsWith("Re:") ? subjBase : `Re: ${subjBase}`;
  const send = await sendToLead({
    lead: current,
    subject: subj,
    body: aiDraft.body,
    templateKey: "ai_reply",
    dedupKey: `ai_reply:${input.externalId ?? `${current.id}:${Date.now()}`}`,
  });

  if (send.ok) {
    await touchEngagement(current.id);
    const updated = await findLeadById(current.id);
    if (updated?.engagement_started_at && !updated.archived) {
      await scheduleFollowUpsForLead(updated.id, new Date(updated.engagement_started_at));
    }
    if (current.status === "NEW") await updateLeadStatus(current.id, "CONTACTED");
  }

  return { leadId: current.id, optedOut: false, replied: send.ok };
}
