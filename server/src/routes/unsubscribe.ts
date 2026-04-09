import { Router } from "express";
import { cancelScheduledFollowUps } from "../services/followUpQueue.js";
import { findLeadByUnsubscribeToken, markOptOut } from "../services/leadRepo.js";

export const unsubscribeRouter = Router();

/** Tokens are hex (legacy backfill) or base64url (new leads); reject garbage without DB lookup. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;

function htmlShell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Unsubscribe</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; background: #f6f7f9; color: #1a1a1a; }
    main { max-width: 28rem; padding: 2rem; background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; line-height: 1.5; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; font-weight: 600; }
    p { margin: 0; color: #444; font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    ${inner}
  </main>
</body>
</html>`;
}

const pageOk = htmlShell(
  `<h1>You have been unsubscribed successfully.</h1>
   <p>You will no longer receive follow-up emails from us.</p>`
);

const pageNeutral = htmlShell(
  `<h1>Request received</h1>
   <p>We could not process this unsubscribe link. If you still receive messages, reply STOP to opt out.</p>`
);

unsubscribeRouter.get("/:token", async (req, res, next) => {
  try {
    const raw = typeof req.params.token === "string" ? req.params.token.trim() : "";
    if (!TOKEN_RE.test(raw)) {
      return res.status(200).type("html").send(pageNeutral);
    }
    const lead = await findLeadByUnsubscribeToken(raw);
    if (!lead) {
      return res.status(200).type("html").send(pageNeutral);
    }
    await markOptOut(lead.id);
    await cancelScheduledFollowUps(lead.id);
    return res.status(200).type("html").send(pageOk);
  } catch (e) {
    next(e);
  }
});
