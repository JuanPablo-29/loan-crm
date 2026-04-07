import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { createSessionToken, findUserByEmail, readSessionToken, verifyPassword } from "../services/auth.js";
import { createGmailOAuth2Client, GMAIL_OAUTH_SCOPES } from "../services/gmailCredentials.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function sessionCookie(token: string): string {
  const secure = config.appBaseUrl.startsWith("https://") ? "; Secure" : "";
  const maxAge = config.auth.sessionTtlHours * 3600;
  return `${config.auth.sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookie(): string {
  return `${config.auth.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const user = await findUserByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = createSessionToken({ id: user.id, email: user.email });
    res.setHeader("Set-Cookie", sessionCookie(token));
    return res.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearCookie());
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  const cookies = (req.headers.cookie ?? "").split(";").map((p) => p.trim());
  const pair = cookies.find((p) => p.startsWith(`${config.auth.sessionCookieName}=`));
  const token = pair ? decodeURIComponent(pair.slice(config.auth.sessionCookieName.length + 1)) : undefined;
  const session = readSessionToken(token);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, user: { id: session.sub, email: session.email } });
});

/**
 * Start Gmail OAuth (Web client). Requires dashboard session.
 * Step 1: Redirect browser to Google consent screen.
 * Step 2: User returns to GET /api/google/callback with ?code=...
 */
authRouter.get("/google", requireAuth, (_req, res, next) => {
  try {
    const oauth2Client = createGmailOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [...GMAIL_OAUTH_SCOPES],
    });
    return res.redirect(302, authUrl);
  } catch (e) {
    next(e);
  }
});
