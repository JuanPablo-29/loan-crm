"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  property_address: string | null;
  status: string;
  intent: string | null;
  lead_score: number;
  is_stuck: boolean;
  stuck_suggestion?: boolean;
  stale_no_reply?: boolean;
  updated_at: string;
  created_at: string;
  clicked_at: string | null;
  engaged_at: string | null;
  pending_follow_up_count: number;
  last_outbound_email_at: string | null;
  awaiting_reply: boolean;
  archived: boolean;
};

const STATUSES = ["", "NEW", "CONTACTED", "FOLLOW_UP", "ENGAGED", "OPTED_OUT"];

const SORTS: { value: string; label: string }[] = [
  { value: "updated", label: "Most recently updated" },
  { value: "activity", label: "Most active (last email)" },
  { value: "created", label: "Newest leads first" },
  { value: "score", label: "Highest score" },
];

function statusClass(s: string) {
  if (s === "OPTED_OUT") return "tag danger";
  if (s === "FOLLOW_UP") return "tag warn";
  if (s === "ENGAGED") return "tag engaged";
  if (s === "CONTACTED") return "tag ok";
  if (s === "NEW") return "tag new";
  return "tag";
}

function formatShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateAddress(value: string | null, max = 34) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("updated");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (sort) q.set("sort", sort);
      const lr = await fetch(`/api/leads?${q}`).then((r) => r.json());
      setLeads(lr.leads ?? []);
    } catch {
      setErr("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status, sort]);

  async function onArchive(id: string) {
    setArchivingId(id);
    setErr(null);
    const prev = leads;
    setLeads((curr) => curr.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/leads/${id}/archive`, { method: "PATCH" });
      if (!res.ok) throw new Error("archive_failed");
    } catch {
      setLeads(prev);
      setErr("Failed to archive lead");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <main>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0, flex: "1 1 auto" }}>Leads</h1>
        <label style={{ margin: 0 }}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ marginTop: 4, minWidth: 180 }}
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
        <label style={{ margin: 0 }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ marginTop: 4, minWidth: 220 }}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
        <a href="/dashboard/csv" className="btn" style={{ textDecoration: "none" }}>
          CSV
        </a>
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 0 }}>
        Internal dashboard — inbound email leads, outbound automation, and link engagement.
      </p>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
              minWidth: 920,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.65rem 0.5rem" }}>Lead</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Phone</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Property</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Created</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Last sent</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Clicked</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Follow-ups</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const rowHighlight =
                  l.stale_no_reply || l.stuck_suggestion
                    ? "rgba(245, 165, 36, 0.08)"
                    : l.status === "NEW"
                      ? "rgba(61, 139, 253, 0.06)"
                      : undefined;
                const engaged = Boolean(l.clicked_at || l.engaged_at || l.status === "ENGAGED");
                return (
                  <tr
                    key={l.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: rowHighlight,
                    }}
                  >
                    <td style={{ padding: "0.65rem 0.5rem", verticalAlign: "top" }}>
                      <a href={`/lead/${l.id}`} style={{ fontWeight: 600, textDecoration: "none", color: "var(--text)" }}>
                        {l.name || l.email}
                      </a>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{l.email}</div>
                      {l.intent && (
                        <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 4 }}>{l.intent}</div>
                      )}
                      {(l.stale_no_reply || l.stuck_suggestion) && (
                        <div className="tag warn" style={{ marginTop: 6 }}>
                          {l.stale_no_reply ? "No reply in 5+ days" : "Possibly stuck"}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", color: "var(--muted)", verticalAlign: "top" }}>
                      {l.phone || "—"}
                    </td>
                    <td
                      style={{ padding: "0.65rem 0.5rem", color: "var(--muted)", verticalAlign: "top", maxWidth: 250 }}
                      title={l.property_address ?? ""}
                    >
                      {truncateAddress(l.property_address)}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", verticalAlign: "top" }}>
                      <span className={statusClass(l.status)}>{l.status}</span>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 6 }}>Score {l.lead_score}</div>
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", color: "var(--muted)", verticalAlign: "top" }}>
                      {formatShort(l.created_at)}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", color: "var(--muted)", verticalAlign: "top" }}>
                      {formatShort(l.last_outbound_email_at)}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", verticalAlign: "top" }}>
                      {l.status === "OPTED_OUT" ? (
                        <span className="tag danger">N/A</span>
                      ) : engaged ? (
                        <span className="tag engaged">Yes</span>
                      ) : (
                        <span className="tag">Not yet</span>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", verticalAlign: "top" }}>
                      {l.pending_follow_up_count > 0 ? (
                        <span className="tag warn">{l.pending_follow_up_count} pending</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem 0.5rem", verticalAlign: "top" }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void onArchive(l.id)}
                        disabled={archivingId === l.id}
                      >
                        {archivingId === l.id ? "Archiving..." : "Archive"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leads.length === 0 && <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No leads match this filter.</p>}
        </div>
      )}
    </main>
  );
}
