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

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [trackedUrl, setTrackedUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`/api/leads/${id}`);
        const data = await res.json();
        if (!data.lead) {
          setErr("Lead not found");
          return;
        }
        setLead(data.lead);
        setEmails(data.emails ?? []);
        setFollowUps(data.follow_ups ?? []);
        setTrackedUrl(data.tracked_redirect_url ?? null);
      } catch {
        setErr("Failed to load");
      }
    }
    void run();
  }, [id]);

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
          <div
            key={e.id}
            className="card"
            style={{
              borderLeft: `4px solid ${
                e.direction === "INBOUND" ? "var(--accent)" : "var(--muted)"
              }`,
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
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: "0.75rem 0 0",
                fontSize: "0.9rem",
              }}
            >
              {e.body_text}
            </pre>
            {e.template_key && (
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 8 }}>Template: {e.template_key}</div>
            )}
          </div>
        ))}
        {sortedEmails.length === 0 && <p style={{ color: "var(--muted)" }}>No messages yet.</p>}
      </div>
    </main>
  );
}
