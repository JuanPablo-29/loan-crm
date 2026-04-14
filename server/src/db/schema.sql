-- Loan CRM core schema (idempotent)

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  intent TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW','CONTACTED','FOLLOW_UP','ENGAGED','OPTED_OUT'
  )),
  engagement_started_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  lead_score INTEGER NOT NULL DEFAULT 50,
  is_stuck BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  property_address TEXT,
  redirect_token TEXT UNIQUE,
  clicked_at TIMESTAMPTZ,
  engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS redirect_token TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS engaged_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived BOOLEAN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE leads SET archived = FALSE WHERE archived IS NULL;
ALTER TABLE leads ALTER COLUMN archived SET DEFAULT FALSE;
ALTER TABLE leads ALTER COLUMN archived SET NOT NULL;
UPDATE leads SET redirect_token = gen_random_uuid()::text WHERE redirect_token IS NULL;
ALTER TABLE leads ALTER COLUMN redirect_token SET DEFAULT gen_random_uuid()::text;
ALTER TABLE leads ALTER COLUMN redirect_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_redirect_token ON leads(redirect_token);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;
-- Use gen_random_uuid() (core in PostgreSQL 13+) — avoids pgcrypto's gen_random_bytes(), which Railway often omits.
UPDATE leads SET unsubscribe_token =
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE unsubscribe_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unsubscribe_token ON leads(unsubscribe_token);
ALTER TABLE leads ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  subject TEXT,
  body_text TEXT NOT NULL,
  external_id TEXT,
  template_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_lead ON emails(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_day INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  bullmq_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','CANCELLED','SKIPPED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_ups_lead_day ON follow_ups(lead_id, sequence_day);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_pending ON follow_ups(status, scheduled_for);

-- Widen status check when table already exists (idempotent)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
-- Legacy rows from older CRM schemas may have removed status values; normalize before CHECK.
UPDATE leads SET status = 'ENGAGED' WHERE status IN (
  'APPLICATION_COMPLETED','APPLICATION_SUBMITTED','COMPLETED'
);
UPDATE leads SET status = 'FOLLOW_UP' WHERE status IN (
  'MISSING_DOCUMENTS','PENDING_DOCS','DOCUMENTS_REQUESTED'
);
UPDATE leads SET status = 'CONTACTED' WHERE status NOT IN (
  'NEW','CONTACTED','FOLLOW_UP','ENGAGED','OPTED_OUT'
);
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'NEW','CONTACTED','FOLLOW_UP','ENGAGED','OPTED_OUT'
));

CREATE TABLE IF NOT EXISTS send_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, dedup_key)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row store for Gmail OAuth refresh token (Web client flow); env GMAIL_REFRESH_TOKEN remains fallback
CREATE TABLE IF NOT EXISTS gmail_oauth_tokens (
  singleton_id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS failed_emails (
  id SERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT,
  html TEXT,
  text TEXT,
  error TEXT,
  error_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'sent', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE failed_emails ADD COLUMN IF NOT EXISTS error_type TEXT;

CREATE INDEX IF NOT EXISTS idx_failed_emails_pending_retry
  ON failed_emails (status, next_retry_at)
  WHERE status IN ('pending', 'retrying');
