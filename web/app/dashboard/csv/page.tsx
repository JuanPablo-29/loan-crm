"use client";

import { useEffect, useState } from "react";

type CsvRow = {
  name: string;
  email: string;
  phone: string;
  property_address: string;
  status: string;
  created_at: string;
  clicked_at: string;
  archived: string;
  archived_at: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = values[i] ?? "";
    }
    return row as CsvRow;
  });
}

export default function CsvPage() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/leads/export/csv");
      if (!res.ok) throw new Error("load_failed");
      const text = await res.text();
      setRows(parseCsv(text));
    } catch {
      setErr("Failed to load CSV preview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, flex: "1 1 auto" }}>Leads CSV</h1>
        <a className="btn btn-primary" href="/api/leads/export/csv">
          Download CSV
        </a>
        <button className="btn" type="button" onClick={() => void loadPreview()}>
          Refresh Preview
        </button>
      </div>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Includes active and archived leads.
      </p>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                <th style={{ padding: "0.6rem 0.5rem" }}>Name</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Email</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Property Address</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Archived</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.email}-${idx}`} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem 0.5rem" }}>{r.name || "—"}</td>
                  <td style={{ padding: "0.6rem 0.5rem", color: "var(--muted)" }}>{r.email}</td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>{r.property_address || "—"}</td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>{r.status}</td>
                  <td style={{ padding: "0.6rem 0.5rem" }}>{r.archived === "true" ? "Yes" : "No"}</td>
                  <td style={{ padding: "0.6rem 0.5rem", color: "var(--muted)" }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No rows in export.</p>}
        </div>
      )}
    </main>
  );
}
