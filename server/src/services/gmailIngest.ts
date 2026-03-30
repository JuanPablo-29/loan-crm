import { google } from "googleapis";
import { config } from "../config.js";
import { ingestRawEmail } from "./ingestion.js";

export async function pollGmailOnce(max = 10): Promise<{ processed: number }> {
  const { clientId, clientSecret, refreshToken } = config.gmail;
  if (!clientId || !clientSecret || !refreshToken) {
    console.warn("[gmail] OAuth not configured — skip poll");
    return { processed: 0 };
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const list = await gmail.users.messages.list({ userId: "me", maxResults: max, q: "is:unread" });
  const ids = list.data.messages ?? [];
  let processed = 0;

  for (const m of ids) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    const headers = full.data.payload?.headers ?? [];
    const get = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
    const from = get("From");
    const subject = get("Subject");
    const emailMatch = from.match(/<([^>]+)>/);
    const fromEmail = emailMatch ? emailMatch[1] : from;
    const fromName = from.replace(/<[^>]+>/, "").trim() || null;

    let rawBody = "";
    const parts = full.data.payload?.parts;
    const walk = (p: typeof full.data.payload) => {
      if (p?.body?.data) {
        rawBody += Buffer.from(p.body.data, "base64url").toString("utf8");
      }
      for (const sub of p?.parts ?? []) walk(sub);
    };
    if (parts?.length) {
      for (const p of parts) walk(p);
    } else {
      walk(full.data.payload);
    }

    if (!fromEmail || !rawBody) continue;
    await ingestRawEmail({
      fromEmail,
      fromName,
      subject,
      rawBody,
      externalId: m.id,
    });
    await gmail.users.messages.modify({
      userId: "me",
      id: m.id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
    processed += 1;
  }

  return { processed };
}
