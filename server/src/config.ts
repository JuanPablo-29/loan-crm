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
  smtp: {
    disabled: String(process.env.SMTP_DISABLED ?? "").toLowerCase() === "true",
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE).toLowerCase() === "true" : undefined,
    requireTls:
      process.env.SMTP_REQUIRE_TLS ? String(process.env.SMTP_REQUIRE_TLS).toLowerCase() === "true" : undefined,
    connectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 15000),
    greetingTimeoutMs: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 10000),
    socketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 20000),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "Loan Team <noreply@example.com>",
  },
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

if (!config.smtp.disabled && (config.smtp.host || config.smtp.user)) {
  const secure = config.smtp.secure ?? config.smtp.port === 465;
  if (config.smtp.port === 465 && !secure) {
    console.warn("[config] SMTP_PORT=465 usually requires SMTP_SECURE=true");
  }
  if (config.smtp.port === 587 && secure) {
    console.warn("[config] SMTP_PORT=587 usually expects SMTP_SECURE=false with STARTTLS");
  }
  if (!config.smtp.pass) {
    console.warn("[config] SMTP_PASS is empty; SMTP auth will likely fail");
  }
}
