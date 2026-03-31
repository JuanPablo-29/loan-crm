import dotenv from "dotenv";

dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: req("DATABASE_URL", "postgresql://loanofficer:loanofficer@localhost:5432/loanofficer"),
  redisUrl: req("REDIS_URL", "redis://localhost:6379"),
  appBaseUrl: req("APP_BASE_URL", "http://localhost:3000"),
  apiPublicUrl: req("API_PUBLIC_URL", "http://localhost:4000"),
  externalApplicationUrl: req("EXTERNAL_APPLICATION_URL", "https://example.com/apply"),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Loan Team <noreply@example.com>",
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  autoPollMinutes: Number(process.env.AUTO_POLL_MINUTES ?? 3),
  maxEmailsPerLeadPerDay: Number(process.env.MAX_EMAILS_PER_LEAD_PER_DAY ?? 8),
  minMinutesBetweenSends: Number(process.env.MIN_MINUTES_BETWEEN_SENDS ?? 5),
  auth: {
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "loancrm_session",
    sessionSecret: req("SESSION_SECRET", "dev-insecure-change-me"),
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
    seedEmail: process.env.AUTH_SEED_EMAIL ?? "",
    seedPassword: process.env.AUTH_SEED_PASSWORD ?? "",
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? process.env.APP_BASE_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
    maxPerWindow: Number(process.env.RATE_LIMIT_MAX_PER_WINDOW ?? 120),
  },
};
