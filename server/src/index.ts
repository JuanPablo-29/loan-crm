import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { applySchema, assertLeadsTable } from "./db/applySchema.js";
import { pool } from "./db/pool.js";
import { leadsRouter } from "./routes/leads.js";
import { ingestRouter } from "./routes/ingest.js";
import { mailPollRouter } from "./routes/mailPoll.js";
import { redirectRouter } from "./routes/redirect.js";
import { authRouter } from "./routes/auth.js";
import { googleOAuthRouter } from "./routes/googleOAuth.js";
import { startFollowUpWorker } from "./services/followUpQueue.js";
import { startGmailScheduler } from "./services/gmailScheduler.js";
import { requireAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { upsertSeedUser } from "./services/auth.js";

async function ensureSchema() {
  await applySchema(pool);
  await assertLeadsTable(pool);
}

const app = express();
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS origin denied"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use("/api/auth", authRouter);
/** Gmail OAuth callback (public; Google redirects here). */
app.use("/api/google", googleOAuthRouter);
app.use("/api/ingest", requireAuth, ingestRouter);
app.use("/api/mail", requireAuth, mailPollRouter);
app.use("/api/leads", requireAuth, leadsRouter);
app.use("/r", redirectRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal error" });
});

async function main() {
  await ensureSchema();
  await upsertSeedUser();
  startFollowUpWorker();
  startGmailScheduler();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
