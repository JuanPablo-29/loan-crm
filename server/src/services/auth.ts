import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { pool } from "../db/pool.js";
import { config } from "../config.js";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  exp: number;
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(value: string): string {
  return createHmac("sha256", config.auth.sessionSecret).update(value).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const computed = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, "hex");
  return storedBuf.length === computed.length && timingSafeEqual(storedBuf, computed);
}

export function createSessionToken(user: { id: string; email: string }): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + config.auth.sessionTtlHours * 3600,
  };
  const payloadEncoded = base64url(JSON.stringify(payload));
  const sig = sign(payloadEncoded);
  return `${payloadEncoded}.${sig}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payloadEncoded, sig] = token.split(".");
  if (!payloadEncoded || !sig) return null;
  const expected = sign(payloadEncoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromBase64url(payloadEncoded).toString("utf8")) as SessionPayload;
    if (!payload?.sub || !payload?.email || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function upsertSeedUser(): Promise<void> {
  if (!config.auth.seedEmail || !config.auth.seedPassword) return;
  const hash = hashPassword(config.auth.seedPassword);
  await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           updated_at = now()`,
    [config.auth.seedEmail.trim().toLowerCase(), hash]
  );
}
