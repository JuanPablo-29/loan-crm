import type express from "express";
import { config } from "../config.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function keyFor(req: express.Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${req.baseUrl}${req.path}`;
}

export function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const now = Date.now();
  const key = keyFor(req);
  const windowMs = config.rateLimit.windowMs;
  const max = config.rateLimit.maxPerWindow;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }
  if (current.count >= max) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  current.count += 1;
  buckets.set(key, current);
  next();
}
