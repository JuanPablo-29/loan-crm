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
import { config } from "../config.js";

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
  email: string | null;
  phone: string | null;
  price: string | null;
  location: string | null;
  message: string | null;
};

type CleanLeadInput = {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  budget: number | null;
  message: string | null;
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

function safeString(value: unknown): string | null {
  if (!value) return null;
  return String(value).trim();
}

function cleanPrice(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, "");
  const num = Number.parseInt(cleaned, 10);
  return Number.isNaN(num) ? null : num;
}

function getBestPrice(matches: string[] | null): string | null {
  if (!matches) return null;

  let best: string | null = null;
  let max = 0;
  for (const m of matches) {
    const num = Number.parseInt(m.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(num) && num > max) {
      max = num;
      best = m;
    }
  }
  return best;
}

function nullIfUnknown(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase() === "unknown" ? null : value;
}

function hasValidEmail(lead: { email?: string | null; declinedEmail?: boolean }): boolean {
  if (lead.declinedEmail) return false;
  return !!lead.email && lead.email.includes("@");
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  return v;
}

function noEmailFallbackAddress(seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 40) || "lead";
  return `noemail+${compact}-${Date.now()}@invalid.local`;
}

function getLoanOfficerRecipientEmail(): string {
  const envOfficer = process.env.LOAN_OFFICER_EMAIL?.trim();
  if (envOfficer) return envOfficer;
  const fromMatch = config.emailFrom.match(/<([^>]+)>/);
  if (fromMatch?.[1]) return fromMatch[1].trim();
  return config.emailFrom.trim();
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function getLoanOfficerPhoneFromEnv(): string | null {
  const p = process.env.LOAN_OFFICER_PHONE?.trim();
  if (!p) return null;
  const digits = normalizePhoneDigits(p);
  return digits.length > 0 ? digits : null;
}

export function extractLeadSection(raw: string): string {
  if (!raw) return "";

  const text = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const startIndex = text.indexOf("New Prospect");
  if (startIndex === -1) return text;

  const sliced = text.slice(startIndex);

  // Stop before known footer/system tails in forwarded marketplace emails.
  const endMarkers = [
    "Thank you, Realtor.com",
    "To unsubscribe from transactional emails",
    "Terms of Use",
    "Privacy",
    "Equal Housing",
    "Sent from",
    "View full listing",
  ];

  let endIndex = sliced.length;
  for (const marker of endMarkers) {
    const i = sliced.indexOf(marker);
    if (i !== -1 && i < endIndex) endIndex = i;
  }
  return sliced.slice(0, endIndex).trim();
}

async function forwardLeadToLoanOfficer(input: { leadId: string; lead: CleanLeadInput }): Promise<void> {
  const subject = `New Lead (No Email) - ${input.lead.name || "Unknown"}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <p><strong>New lead requires manual follow-up</strong></p>
      <p><strong>Name:</strong> ${input.lead.name || "N/A"}</p>
      <p><strong>Phone:</strong> ${input.lead.phone || "N/A"}</p>
      <p><strong>Location:</strong> ${input.lead.address || "N/A"}</p>
      <p><strong>Budget:</strong> ${input.lead.budget ?? "N/A"}</p>
      <p><strong>Message:</strong><br/>${(input.lead.message || "No message provided").replace(/\n/g, "<br/>")}</p>
    </div>
  `;
  const to = getLoanOfficerRecipientEmail();
  const result = await sendMail({
    to,
    subject,
    text: `New lead requires manual follow-up\n\nName: ${input.lead.name || "N/A"}\nPhone: ${input.lead.phone || "N/A"}\nLocation: ${input.lead.address || "N/A"}\nBudget: ${input.lead.budget ?? "N/A"}\n\nMessage:\n${input.lead.message || "No message provided"}`,
    html,
  });
  if (!result.ok) {
    console.warn("[ingest] failed to forward no-email lead to loan officer", { leadId: input.leadId, to });
    return;
  }
  console.log("Forwarded no-email lead to loan officer:", input.leadId);
}

/** Parse large raw/HTML lead emails down to the fields we need for AI extraction/personalization. */
export function extractRelevantLeadData(raw: string): RelevantLeadData {
  if (!raw) {
    return { name: null, email: null, phone: null, price: null, location: null, message: null };
  }

  const leadText = extractLeadSection(raw)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  console.log("[ingest] Lead Section:", truncate(leadText, 1500));

  // Name before phone: supports full names, middle initials, and optional "Live transfer" noise.
  const nameMatch = leadText.match(
    /([A-Z][a-z]+(?:\s(?:[A-Z](?:\.|\b)|[A-Z][a-z]+))+)(?:\s+Live(?:\s+transfer)?)?\s*\(\d{3}\)\s?\d{3}-\d{4}/
  );
  const emailMatch = leadText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const phoneMatch = leadText.match(/\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
  const priceMatches = leadText.match(/\$\d[\d,]*/g);
  const bestPrice = getBestPrice(priceMatches);
  const locationMatch = leadText.match(/\b([A-Za-z][A-Za-z\s.'-]+,\s?[A-Z]{2},?\s?\d{5}(?:-\d{4})?)\b/);
  const messageMatch = leadText.match(/Customer Message[:\s]*([\s\S]*?)(?:Called|Phone|Email|Best Regards|Thank you|$)/i);
  let name = nameMatch?.[1] ?? null;
  if (!name) {
    const fallback1 = leadText.match(
      /([A-Z][a-z]+(?:\s(?:[A-Z](?:\.|\b)|[A-Z][a-z]+))+)\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/
    );
    if (fallback1) name = fallback1[1];
  }
  if (!name) {
    const fallback2 = leadText.match(
      /New Prospect.*?\.\s+([A-Z][a-z]+(?:\s(?:[A-Z](?:\.|\b)|[A-Z][a-z]+))+)/i
    );
    if (fallback2) name = fallback2[1];
  }
  if (!name) {
    const fallback3 = leadText.match(/Message\s+([A-Z][a-z]+(?:\s(?:[A-Z](?:\.|\b)|[A-Z][a-z]+))+)/);
    if (fallback3) name = fallback3[1];
  }
  if (!name) {
    const singleNameMatch = leadText.match(
      /New Prospect.*?\.\s+([A-Z][a-z]+)\s*\(\d{3}\)\s?\d{3}-\d{4}/
    );
    if (singleNameMatch) name = singleNameMatch[1];
  }
  if (!name) {
    const phoneAnchorSingleName = leadText.match(/([A-Z][a-z]+)\s*\(\d{3}\)\s?\d{3}-\d{4}/);
    if (phoneAnchorSingleName) name = phoneAnchorSingleName[1];
  }
  if (name) {
    name = name
      .replace(/\bLive\b/gi, "")
      .replace(/\btransfer\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!name) {
    console.warn("Name could not be extracted");
  }
  console.log("Extracted Name:", name);
  let message = messageMatch?.[1] ?? "";
  message = message.replace(/\[.*$/, "").replace(/\s+/g, " ").trim();
  let email = emailMatch?.[0] ?? null;
  let phone = phoneMatch?.[0] ?? null;

  const loanOfficerEmail = process.env.LOAN_OFFICER_EMAIL?.trim().toLowerCase();
  if (email && loanOfficerEmail && email.trim().toLowerCase() === loanOfficerEmail) {
    email = null;
  }
  const loanOfficerPhone = getLoanOfficerPhoneFromEnv();
  if (phone && loanOfficerPhone && normalizePhoneDigits(phone) === loanOfficerPhone) {
    phone = null;
  }

  return {
    name,
    email,
    phone,
    price: bestPrice,
    location: locationMatch?.[1] ?? null,
    message: message || null,
  };
}

function toCleanLeadInput(extracted: RelevantLeadData): CleanLeadInput {
  const cleanedLead: CleanLeadInput = {
    name: safeString(extracted.name),
    phone: safeString(extracted.phone),
    email: safeString(extracted.email),
    address: safeString(extracted.location),
    budget: cleanPrice(extracted.price),
    message: safeString(extracted.message),
  };

  if (cleanedLead.budget && cleanedLead.budget < 1000) {
    console.warn("[ingest] Suspicious budget detected:", cleanedLead.budget);
  }

  cleanedLead.name = nullIfUnknown(cleanedLead.name);
  cleanedLead.phone = nullIfUnknown(cleanedLead.phone);
  cleanedLead.email = nullIfUnknown(cleanedLead.email);
  cleanedLead.address = nullIfUnknown(cleanedLead.address);
  cleanedLead.message = nullIfUnknown(cleanedLead.message);

  return cleanedLead;
}

function buildAiExtractionPrompt(input: {
  fromEmail: string;
  subject?: string;
  cleanedLead: CleanLeadInput;
}): string {
  const customerMessage = input.cleanedLead.message
    ? truncate(input.cleanedLead.message, 700)
    : `No direct customer message provided. Use only name/location context:
Name: ${input.cleanedLead.name || "there"}
Location: ${input.cleanedLead.address || "unknown"}`;

  const prompt = `You are extracting structured data for a mortgage CRM. Return valid JSON only with keys:
name, email, phone, property_address, budget, notes, intent, lead_score_hint.

Context:
From: ${input.fromEmail}
Subject: ${input.subject ?? ""}
Name: ${input.cleanedLead.name || "there"}
Phone: ${input.cleanedLead.phone || "unknown"}
Location: ${input.cleanedLead.address || "unknown"}
Budget: ${input.cleanedLead.budget ?? "unknown"}

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
  const cleanedLead = toCleanLeadInput(relevantLead);
  console.log("[ingest] Clean Lead:", cleanedLead);
  const extractionPrompt = buildAiExtractionPrompt({
    fromEmail: input.fromEmail,
    subject: input.subject,
    cleanedLead,
  });
  const extracted = await extractLeadFieldsFromEmail(extractionPrompt);
  const declinedEmail = /declined to provide email/i.test(input.rawBody);
  const extractedEmail = normalizeOptionalEmail(extracted.email ?? cleanedLead.email);
  const usingLeadEmail = hasValidEmail({ email: extractedEmail, declinedEmail });
  const storageEmail = usingLeadEmail
    ? normalizeEmail(extractedEmail as string)
    : noEmailFallbackAddress(input.externalId ?? cleanedLead.phone ?? cleanedLead.name ?? input.fromEmail);
  let lead = await findLeadByEmail(storageEmail);
  if (!lead) {
    lead = await createLead({
      name: extracted.name ?? cleanedLead.name ?? input.fromName ?? null,
      email: storageEmail,
      phone: extracted.phone ?? cleanedLead.phone,
      property_address: extracted.property_address ?? cleanedLead.address,
      notes: extracted.notes ?? cleanedLead.message,
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
  await setLeadPropertyAddressIfMissing(current.id, extracted.property_address ?? cleanedLead.address);
  current = await findLeadById(lead.id);
  if (!current) throw new Error("Lead missing after property update");

  if (!usingLeadEmail) {
    await forwardLeadToLoanOfficer({ leadId: current.id, lead: cleanedLead });
    console.log("Lead routed to manual follow-up (no email):", current.id);
    return { leadId: current.id, optedOut: false, replied: false };
  }

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
