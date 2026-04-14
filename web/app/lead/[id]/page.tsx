"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Email = {
  id: string;
  direction: string;
  subject: string | null;
  body_text: string;
  created_at: string;
  template_key: string | null;
};

type FollowUp = {
  id: string;
  sequence_day: number;
  scheduled_for: string;
  status: string;
  created_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  property_address: string | null;
  notes: string | null;
  status: string;
  intent: string | null;
  lead_score: number;
  redirect_token: string;
  clicked_at: string | null;
  engaged_at: string | null;
  created_at: string;
  updated_at: string;
  last_outbound_at: string | null;
  opted_out_at: string | null;
};

type TimelineEvent = {
  at: string;
  title: string;
  detail?: string;
  kind: "system" | "email_in" | "email_out" | "follow_up" | "click";
};

function statusClass(s: string) {
  if (s === "OPTED_OUT") return "tag danger";
  if (s === "FOLLOW_UP") return "tag warn";
  if (s === "ENGAGED") return "tag engaged";
  if (s === "CONTACTED") return "tag ok";
  if (s === "NEW") return "tag new";
  return "tag";
}

function isValidLeadEmailForResend(email: string): boolean {
  const t = email.trim();
  if (!t.includes("@")) return false;
  if (t.toLowerCase().endsWith("@invalid.local")) return false;
  return true;
}

const LONG_EMAIL_CHARS = 800;

/** Inbound messages that look like forwarded portal leads or very long threads — collapse by default. */
function isLeadSourceInquiry(e: Email): boolean {
  if (e.direction !== "INBOUND") return false;
  const subj = (e.subject ?? "").toLowerCase();
  const body = e.body_text ?? "";
  const keywordHit =
    subj.includes("prospect") || subj.includes("lead") || subj.includes("referral");
  return keywordHit || body.length > LONG_EMAIL_CHARS;
}

/** Outbound: only auto-collapse when long (Kari / AI). Inbound: collapse for lead-source heuristic above. */
function isCollapsibleEmail(e: Email): boolean {
  const len = (e.body_text ?? "").length;
  return isLeadSourceInquiry(e) || (e.direction === "OUTBOUND" && len > LONG_EMAIL_CHARS);
}

function EmailThreadMessage({ e }: { e: Email }) {
  const collapsible = isCollapsibleEmail(e);
  const leadSource = isLeadSourceInquiry(e);
  const [expanded, setExpanded] = useState(!collapsible);

  const collapsedToggleLabel = leadSource ? "Show full lead email" : "Show full email";

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${e.direction === "INBOUND" ? "var(--accent)" : "var(--muted)"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong>{e.direction === "INBOUND" ? "Inbound — Lead" : "Outbound — Assistant"}</strong>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          {new Date(e.created_at).toLocaleString()}
        </span>
      </div>
      {e.subject && (
        <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>{e.subject}</div>
      )}
      {leadSource && (
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 8, marginBottom: 2 }}>
          Lead source email
        </div>
      )}
      <div
        style={{
          maxHeight: collapsible && !expanded ? 160 : undefined,
          overflow: collapsible && !expanded ? "hidden" : undefined,
          position: "relative",
        }}
      >
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            margin: leadSource ? "0.25rem 0 0" : "0.75rem 0 0",
            fontSize: "0.9rem",
          }}
        >
          {e.body_text}
        </pre>
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="email-thread-toggle"
          style={{
            marginTop: 10,
            padding: "2px 0",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ok)",
            textAlign: "left",
          }}
        >
          {expanded ? "Show less" : collapsedToggleLabel}
        </button>
      )}
      {e.template_key && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 8 }}>Template: {e.template_key}</div>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [trackedUrl, setTrackedUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [resendState, setResendState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`/api/leads/${id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          setErr(
            res.status === 401
              ? "Session expired. Sign in again at /login."
              : data?.error ?? `Failed to load (${res.status})`
          );
          return;
        }
        if (!data.lead) {
          setErr("Lead not found");
          return;
        }
        setLead(data.lead);
        setNotes(data.lead.notes ?? "");
        setEmails(data.emails ?? []);
        setFollowUps(data.follow_ups ?? []);
        setTrackedUrl(data.tracked_redirect_url ?? null);
      } catch {
        setErr("Failed to load");
      }
    }
    void run();
  }, [id]);

  useEffect(() => {
    if (!lead) return;
    if (notes === (lead.notes ?? "")) return;
    const timer = setTimeout(async () => {
      try {
        setSaveState("saving");
        const res = await fetch(`/api/leads/${lead.id}/notes`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaveState("error");
          console.error("[lead-notes] save failed", res.status, data);
          return;
        }
        if (data?.lead) setLead(data.lead);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch (e) {
        setSaveState("error");
        console.error("[lead-notes] save error", e);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [notes, lead]);

  const timeline = useMemo(() => {
    if (!lead) return [];
    const ev: TimelineEvent[] = [];

    ev.push({
      at: lead.created_at,
      title: "Lead ingested",
      detail: "Created from inbound email pipeline",
      kind: "system",
    });

    for (const e of emails) {
      ev.push({
        at: e.created_at,
        title: e.direction === "INBOUND" ? "Inbound email" : "Outbound email",
        detail: e.subject ?? (e.direction === "INBOUND" ? "Message from lead" : "Automated / assistant send"),
        kind: e.direction === "INBOUND" ? "email_in" : "email_out",
      });
    }

    for (const f of followUps) {
      const st = f.status.toLowerCase();
      ev.push({
        at: f.created_at,
        title: `Follow-up day ${f.sequence_day} scheduled`,
        detail: `Fire at ${new Date(f.scheduled_for).toLocaleString()} · ${st}`,
        kind: "follow_up",
      });
    }

    if (lead.clicked_at) {
      ev.push({
        at: lead.clicked_at,
        title: "Tracked application link clicked",
        detail: "Engagement recorded; follow-ups stopped",
        kind: "click",
      });
    }

    ev.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return ev;
  }, [lead, emails, followUps]);

  if (err) {
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>{err}</p>
      </main>
    );
  }
  if (!lead) {
    return (
      <main>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  const sortedEmails = [...emails].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const hasOutbound = emails.some((e) => e.direction === "OUTBOUND");
  const canResendInitial =
    lead.status !== "OPTED_OUT" && isValidLeadEmailForResend(lead.email);

  async function reloadLeadDetail() {
    const res = await fetch(`/api/leads/${id}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.lead) {
      setLead(data.lead);
      setEmails(data.emails ?? []);
      setFollowUps(data.follow_ups ?? []);
    }
  }

  async function handleResendInitialEmail() {
    if (!lead || !canResendInitial || resendState === "loading") return;
    const leadId = lead.id;
    const confirmMsg = hasOutbound
      ? "An outbound email was already sent to this lead. Send another initial-style email anyway?"
      : "Resend the initial outreach email to this lead?";
    if (!window.confirm(confirmMsg)) return;

    setResendState("loading");
    setResendMessage(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/resend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: hasOutbound }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendState("error");
        setResendMessage(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`);
        return;
      }
      setResendState("success");
      setResendMessage("Email sent");
      await reloadLeadDetail();
      setTimeout(() => {
        setResendState("idle");
        setResendMessage(null);
      }, 4000);
    } catch {
      setResendState("error");
      setResendMessage("Network error");
    }
  }

  return (
    <main>
      <p>
        <a href="/dashboard">← Back</a>
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>{lead.name || lead.email}</h1>
        <p style={{ margin: "0.25rem 0", color: "var(--muted)" }}>{lead.email}</p>
        {lead.phone && <p style={{ margin: "0.25rem 0" }}>Phone: {lead.phone}</p>}
        {lead.property_address && <p style={{ margin: "0.25rem 0" }}>Property address: {lead.property_address}</p>}
        <p style={{ margin: "0.75rem 0" }}>
          <span className={statusClass(lead.status)}>{lead.status}</span>{" "}
          <span style={{ color: "var(--muted)", marginLeft: 8 }}>Score {lead.lead_score}</span>
        </p>
        {lead.intent && <p>Intent: {lead.intent}</p>}
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Created {new Date(lead.created_at).toLocaleString()} · Updated {new Date(lead.updated_at).toLocaleString()}
        </p>
        <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn"
            disabled={!canResendInitial || resendState === "loading"}
            onClick={() => void handleResendInitialEmail()}
          >
            {resendState === "loading" ? "Sending…" : "Resend Initial Email"}
          </button>
          {!isValidLeadEmailForResend(lead.email) && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No valid lead email on file.</span>
          )}
          {lead.status === "OPTED_OUT" && (
            <span style={{ fontSize: "0.8rem", color: "var(--danger)" }}>Lead opted out — cannot send.</span>
          )}
          {resendMessage && (
            <span
              style={{
                fontSize: "0.85rem",
                color: resendState === "error" ? "var(--danger)" : "var(--ok)",
              }}
            >
              {resendMessage}
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Lead notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
          placeholder="Add notes about this lead..."
          rows={7}
          style={{ resize: "vertical", marginBottom: 8 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.8rem" }}>
          <span style={{ color: "var(--muted)" }}>{notes.length}/5000</span>
          {saveState === "saving" && <span style={{ color: "var(--muted)" }}>Saving…</span>}
          {saveState === "saved" && <span style={{ color: "var(--ok)" }}>Saved</span>}
          {saveState === "error" && <span style={{ color: "var(--danger)" }}>Failed to save</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Redirect tracking</h2>
        <dl style={{ margin: 0, display: "grid", gap: "0.5rem 1.5rem", fontSize: "0.9rem" }}>
          <dt style={{ color: "var(--muted)" }}>redirect_token</dt>
          <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: "monospace" }}>{lead.redirect_token}</dd>
          <dt style={{ color: "var(--muted)" }}>clicked_at</dt>
          <dd style={{ margin: 0 }}>{lead.clicked_at ? new Date(lead.clicked_at).toLocaleString() : "—"}</dd>
          <dt style={{ color: "var(--muted)" }}>engaged_at</dt>
          <dd style={{ margin: 0 }}>{lead.engaged_at ? new Date(lead.engaged_at).toLocaleString() : "—"}</dd>
          {trackedUrl && (
            <>
              <dt style={{ color: "var(--muted)" }}>Tracked URL (API_PUBLIC_URL)</dt>
              <dd style={{ margin: 0, wordBreak: "break-all" }}>
                <a href={trackedUrl}>{trackedUrl}</a>
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Timeline</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {timeline.map((e, i) => (
            <li key={`${e.at}-${e.kind}-${i}`} style={{ color: "var(--text)" }}>
              <strong>{new Date(e.at).toLocaleString()}</strong> — {e.title}
              {e.detail && (
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>{e.detail}</div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <h2 style={{ fontSize: "1.1rem" }}>Email thread</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        Inbound = lead · Outbound = assistant / automation
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {sortedEmails.map((e) => (
          <EmailThreadMessage key={e.id} e={e} />
        ))}
        {sortedEmails.length === 0 && <p style={{ color: "var(--muted)" }}>No messages yet.</p>}
      </div>
    </main>
  );
}
