import { google } from "googleapis";
import { config } from "../config.js";
import {
  clearStoredGmailRefreshToken,
  createGmailOAuth2Client,
  getGmailRefreshToken,
} from "./gmailCredentials.js";
import { ingestRawEmail } from "./ingestion.js";

function isInvalidGrantError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as Record<string, unknown>;
  const data = (o.response as { data?: { error?: string; error_description?: string } } | undefined)?.data;
  if (data?.error === "invalid_grant") return true;
  const msg = String(o.message ?? "").toLowerCase();
  return msg.includes("invalid_grant");
}

/** Avoid spamming logs every poll interval while credentials remain invalid. */
let lastInvalidGrantDetailLogAt = 0;
const INVALID_GRANT_LOG_COOLDOWN_MS = 60 * 60 * 1000;

export async function pollGmailOnce(max = 10): Promise<{ processed: number; authError?: boolean }> {
  const { clientId, clientSecret } = config.gmail;
  if (!clientId || !clientSecret) {
    console.warn("[gmail] GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET missing — skip poll");
    return { processed: 0 };
  }

  const refreshToken = await getGmailRefreshToken();
  if (!refreshToken) {
    console.warn("[gmail] No refresh token (set GMAIL_REFRESH_TOKEN or complete OAuth at GET /api/auth/google) — skip poll");
    return { processed: 0 };
  }

  const oauth2 = createGmailOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  let list;
  try {
    list = await gmail.users.messages.list({ userId: "me", maxResults: max, q: "is:unread" });
  } catch (err) {
    if (isInvalidGrantError(err)) {
      await clearStoredGmailRefreshToken();
      const now = Date.now();
      if (now - lastInvalidGrantDetailLogAt >= INVALID_GRANT_LOG_COOLDOWN_MS) {
        lastInvalidGrantDetailLogAt = now;
        console.warn(
          "[gmail] invalid_grant — Google rejected the refresh token (expired or revoked). " +
            "Reconnect Gmail via your app's Google OAuth flow, or set a fresh GMAIL_REFRESH_TOKEN. " +
            "Any DB-stored token was cleared so env-based token can be used on the next poll if configured."
        );
      } else {
        console.warn("[gmail] invalid_grant (still failing; fix credentials — this message is throttled hourly)");
      }
      return { processed: 0, authError: true };
    }
    throw err;
  }

  const ids = list.data.messages ?? [];
  let processed = 0;

  for (const m of ids) {
    if (!m.id) continue;
    let full;
    try {
      full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
    } catch (err) {
      if (isInvalidGrantError(err)) {
        await clearStoredGmailRefreshToken();
        console.warn("[gmail] invalid_grant during message fetch — cleared stored token; throttled details may apply on next list.");
        return { processed, authError: true };
      }
      throw err;
    }
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
    try {
      await gmail.users.messages.modify({
        userId: "me",
        id: m.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    } catch (err) {
      if (isInvalidGrantError(err)) {
        await clearStoredGmailRefreshToken();
        return { processed, authError: true };
      }
      throw err;
    }
    processed += 1;
  }

  return { processed };
}
