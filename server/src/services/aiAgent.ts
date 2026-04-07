import OpenAI from "openai";
import { config } from "../config.js";
import type { EmailRow, LeadRow } from "../types.js";

const SYSTEM = `You are a professional loan assistant supporting a loan officer with lead follow-up by email. Be polite, clear, concise, and slightly persistent without sounding spammy. Reference prior messages naturally. Ask simple next-step questions and invite replies.`;

const client = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

function firstNameFromLead(lead: Pick<LeadRow, "name">): string {
  const raw = (lead.name ?? "").trim();
  if (!raw) return "there";
  const token = raw.split(/\s+/)[0] ?? "";
  return token.replace(/[^a-zA-Z'-]/g, "") || "there";
}

function cleanField(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : "Not provided";
}

function buildLeadSummary(lead: Pick<LeadRow, "name" | "email" | "phone" | "property_address" | "intent" | "notes" | "lead_score" | "status">): string {
  return [
    `Lead Name: ${cleanField(lead.name)}`,
    `Lead Email: ${cleanField(lead.email)}`,
    `Lead Phone: ${cleanField(lead.phone)}`,
    `Property Address: ${cleanField(lead.property_address)}`,
    `Intent: ${cleanField(lead.intent)}`,
    `Notes: ${cleanField(lead.notes)}`,
    `Lead Score: ${lead.lead_score}`,
    `Status: ${lead.status}`,
  ].join("\n");
}

export async function extractLeadFieldsFromEmail(raw: string): Promise<{
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  budget: string | null;
  notes: string | null;
  intent: string | null;
  lead_score_hint: number | null;
}> {
  if (!client) {
    return {
      name: null,
      email: null,
      phone: null,
      property_address: null,
      budget: null,
      notes: null,
      intent: "inquiry",
      lead_score_hint: null,
    };
  }
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract structured lead info from forwarded loan emails. Return valid JSON only with keys: name, email, phone, property_address, budget, notes, intent, lead_score_hint. Rules: prefer the CLIENT property (not agent/broker office info), capture full address with street/city/state/zip when present, ignore legal/footer/disclaimer text, and use null for unknown values.",
        },
        { role: "user", content: raw.slice(0, 12000) },
      ],
    });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new Error("No extraction from model");
    return JSON.parse(text) as {
      name: string | null;
      email: string | null;
      phone: string | null;
      property_address: string | null;
      budget: string | null;
      notes: string | null;
      intent: string | null;
      lead_score_hint: number | null;
    };
  } catch {
    return {
      name: null,
      email: null,
      phone: null,
      property_address: null,
      budget: null,
      notes: null,
      intent: "inquiry",
      lead_score_hint: null,
    };
  }
}

function formatThread(emails: EmailRow[]): string {
  return emails
    .map(
      (e) =>
        `${e.direction === "INBOUND" ? "Lead" : "Assistant"} (${e.created_at.toISOString()}):\n${e.body_text}`
    )
    .join("\n\n---\n\n");
}

export async function generateReply(input: {
  thread: EmailRow[];
  leadName: string | null;
  context: string;
}): Promise<string> {
  if (!client) {
    return `Hi${input.leadName ? ` ${input.leadName}` : ""},\n\nThanks for reaching out. I can help with next steps and answer any loan questions. If you're open to it, reply with your preferred timeline and loan amount so we can guide you quickly.\n\nReply STOP anytime to opt out.`;
  }
  const thread = formatThread(input.thread);
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Context: ${input.context}\n\nConversation:\n${thread}\n\nWrite the next email reply body only (no subject). Focus on continuing the conversation and moving the lead toward a response from this email thread. Do not include external links or portals. Mention "Reply STOP to opt out." once near the end.`,
      },
    ],
  });
  const out = res.choices[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty AI reply");
  return out;
}

export async function generatePersonalizedOutboundEmail(input: {
  lead: Pick<LeadRow, "name" | "email" | "phone" | "property_address" | "intent" | "notes" | "lead_score" | "status">;
  thread?: EmailRow[];
  objective: string;
  subjectHint?: string;
}): Promise<{ subject: string; body: string }> {
  const firstName = firstNameFromLead(input.lead);
  const fallback = {
    subject: input.subjectHint?.trim() || "Checking in about your home financing",
    body: `Hello ${firstName},

I wanted to follow up based on your loan inquiry and share guidance specific to your situation. I can help you compare options and next steps based on your timeline and goals.

If helpful, reply with your preferred timeline and any questions, and I will tailor recommendations for you.

Warm regards,

Kari Pastrana`,
  };
  if (!client) return fallback;

  const leadSummary = buildLeadSummary(input.lead);
  const threadText =
    input.thread && input.thread.length > 0
      ? formatThread(input.thread.slice(-12))
      : "No prior email thread.";
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an email assistant for Kari Pastrana, a professional loan officer. Generate concise, natural, personalized outbound emails. Use a warm and professional tone. Avoid generic phrasing. Address the lead by name when available, reference their specific situation from provided fields, avoid repetition, and include a subtle call-to-action. Return strict JSON with keys: subject, body.",
      },
      {
        role: "user",
        content: [
          `Objective: ${input.objective}`,
          input.subjectHint ? `Subject Hint: ${input.subjectHint}` : "Subject Hint: Not provided",
          "",
          "Lead Data:",
          leadSummary,
          "",
          "Recent Conversation:",
          threadText,
          "",
          "Requirements:",
          "- Write body text only (no HTML).",
          '- Sign off as "Kari Pastrana".',
          "- Do not include links; links and unsubscribe text are added downstream.",
          "- Keep body around 90-160 words unless conversation context requires slightly more.",
        ].join("\n"),
      },
    ],
  });
  const content = res.choices[0]?.message?.content;
  if (!content) return fallback;
  const parsed = JSON.parse(content) as { subject?: string; body?: string };
  const subject = parsed.subject?.trim() || fallback.subject;
  const body = parsed.body?.trim() || fallback.body;
  return { subject, body };
}
