import OpenAI from "openai";
import { config } from "../config.js";
import type { EmailRow } from "../types.js";

const SYSTEM = `You are a professional loan assistant supporting a loan officer with lead follow-up by email. Be polite, clear, concise, and slightly persistent without sounding spammy. Reference prior messages naturally. Ask simple next-step questions and invite replies.`;

const client = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

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
