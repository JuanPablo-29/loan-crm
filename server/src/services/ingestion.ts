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
import { sendToLead } from "./leadOutbound.js";
import { sendMail } from "./outboundMail.js";
import { scheduleFollowUpsForLead, cancelScheduledFollowUps } from "./followUpQueue.js";

const OPT_OUT_RE = /\b(stop|unsubscribe|opt\s*out|remove\s+me|cancel\s+emails?)\b/i;

export function bodyRequestsOptOut(text: string): boolean {
  return OPT_OUT_RE.test(text);
}

export async function ingestRawEmail(input: {
  rawBody: string;
  subject?: string;
  fromEmail: string;
  fromName?: string | null;
  externalId?: string | null;
}): Promise<{ leadId: string; optedOut: boolean; replied: boolean }> {
  const extracted = await extractLeadFieldsFromEmail(
    `Subject: ${input.subject ?? ""}\nFrom: ${input.fromEmail}\n\n${input.rawBody}`
  );
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

  if (bodyRequestsOptOut(input.rawBody)) {
    await markOptOut(current.id);
    await cancelScheduledFollowUps(current.id);
    const ack =
      "We've removed you from automated follow-ups. If you need help in the future, you can reach us anytime.";
    await sendMail({
      to: current.email,
      subject: "You are unsubscribed",
      text: ack,
    });
    await insertEmail({
      lead_id: current.id,
      direction: "OUTBOUND",
      subject: "You are unsubscribed",
      body_text: ack,
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
