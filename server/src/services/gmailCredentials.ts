import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { pool } from "../db/pool.js";

/** Gmail API scopes for read + mark-as-read (modify). */
export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
] as const;

/**
 * Creates an OAuth2 client for the configured Web application client.
 * Redirect URI must match exactly what is registered in Google Cloud Console.
 */
export function createGmailOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = config.gmail;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are required for Gmail OAuth");
  }
  if (!redirectUri) {
    throw new Error("GMAIL_REDIRECT_URI is required for Gmail OAuth (no hardcoded fallback)");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * If GMAIL_REFRESH_TOKEN is set in the environment, apply it immediately (sync).
 * Database token is applied via getGmailRefreshToken / applyStoredGmailCredentials.
 */
export function applyEnvGmailRefreshTokenIfPresent(oauth2: OAuth2Client): void {
  const rt = config.gmail.refreshToken?.trim();
  if (rt) oauth2.setCredentials({ refresh_token: rt });
}

/**
 * Load refresh token from DB singleton row; falls back to env if no row.
 */
export async function getGmailRefreshToken(): Promise<string | null> {
  const envRt = config.gmail.refreshToken?.trim();
  try {
    const { rows } = await pool.query<{ refresh_token: string }>(
      `SELECT refresh_token FROM gmail_oauth_tokens WHERE singleton_id = 1 LIMIT 1`
    );
    const dbRt = rows[0]?.refresh_token?.trim();
    return dbRt || envRt || null;
  } catch {
    return envRt || null;
  }
}

/** Persist refresh token after OAuth callback (overwrites previous). */
export async function saveGmailRefreshTokenToDb(refreshToken: string): Promise<void> {
  await pool.query(
    `INSERT INTO gmail_oauth_tokens (singleton_id, refresh_token, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (singleton_id) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       updated_at = now()`,
    [refreshToken]
  );
}

/**
 * Apply stored credentials so googleapis can refresh access tokens automatically on API calls.
 */
export async function applyStoredGmailCredentials(oauth2: OAuth2Client): Promise<void> {
  const rt = await getGmailRefreshToken();
  if (rt) oauth2.setCredentials({ refresh_token: rt });
}
