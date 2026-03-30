import type express from "express";
import { config } from "../config.js";
import { readSessionToken } from "../services/auth.js";

function parseCookie(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf("=");
    if (idx <= 0) return acc;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const cookies = parseCookie(req.headers.cookie);
  const token = cookies[config.auth.sessionCookieName];
  const session = readSessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as express.Request & { user?: { id: string; email: string } }).user = {
    id: session.sub,
    email: session.email,
  };
  next();
}
