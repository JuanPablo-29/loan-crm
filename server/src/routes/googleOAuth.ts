import { Router } from "express";
import { createGmailOAuth2Client, GMAIL_OAUTH_SCOPES, saveGmailRefreshTokenToDb } from "../services/gmailCredentials.js";

/**
 * Public OAuth callback — Google redirects the user's browser here with ?code=...
 * Must match GMAIL_REDIRECT_URI exactly (e.g. https://your-app/api/google/callback via Next rewrite).
 */
export const googleOAuthRouter = Router();

googleOAuthRouter.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  const errorDescription =
    typeof req.query.error_description === "string" ? req.query.error_description : undefined;

  if (error) {
    console.error("[gmail-oauth] Google returned error", { error, error_description: errorDescription });
    return res.status(400).json({
      ok: false,
      error: "oauth_denied_or_failed",
      detail: errorDescription ?? error,
    });
  }

  if (!code) {
    return res.status(400).json({
      ok: false,
      error: "missing_code",
      message: "Expected query parameter ?code= from Google OAuth redirect.",
    });
  }

  try {
    // Step 1: Build client with same redirect URI used when generating the auth URL.
    const oauth2Client = createGmailOAuth2Client();

    // Step 2: Exchange authorization code for access + refresh tokens.
    const { tokens } = await oauth2Client.getToken(code);

    // Step 3: Log tokens for operator visibility (refresh token only issued on first consent).
    console.log("[gmail-oauth] Token response from Google:", JSON.stringify(tokens));

    // Step 4: Persist refresh token when Google provides it (required for long-lived server access).
    if (tokens.refresh_token) {
      await saveGmailRefreshTokenToDb(tokens.refresh_token);
      console.log("[gmail-oauth] Refresh token saved to database (gmail_oauth_tokens).");
    } else {
      console.warn(
        "[gmail-oauth] No refresh_token in response. Revoke app access in Google Account and repeat OAuth with prompt=consent, or token already exists in DB/env."
      );
    }

    // Step 5: Attach credentials so this client instance can call APIs immediately if needed.
    oauth2Client.setCredentials(tokens);

    return res.status(200).json({
      ok: true,
      message:
        tokens.refresh_token != null
          ? "Gmail connected. Refresh token stored in the database; polling will use it automatically."
          : "Tokens received but no new refresh_token. If Gmail was already linked, existing DB/env refresh token is still used.",
      has_refresh_token: Boolean(tokens.refresh_token),
      hint:
        "You may also set GMAIL_REFRESH_TOKEN in Railway as a fallback; when a row exists in gmail_oauth_tokens, that refresh token is used first.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    console.error("[gmail-oauth] getToken failed", e);
    return res.status(400).json({
      ok: false,
      error: "token_exchange_failed",
      message,
    });
  }
});
