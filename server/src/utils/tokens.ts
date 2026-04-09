import { randomBytes } from "node:crypto";

export function generateRedirectToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Unguessable token for one-click email unsubscribe (separate from redirect_token). */
export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("base64url");
}
