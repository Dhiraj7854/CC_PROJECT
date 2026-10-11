"use client";

import { useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TABS = [
  { id: "sbi", label: "SBI", endpoint: "/upload/sbi" },
  { id: "phonepe", label: "PhonePe", endpoint: "/upload/phonepe" },
  { id: "gpay", label: "GPay", endpoint: "/upload/gpay" },
  { id: "auto", label: "Auto-detect", endpoint: "/upload" },
];
const COLS = ["date", "time", "description", "type", "amount", "category", "UTR_No"];

function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n");
}

const card = { background: "#1e293b", borderRadius: 12, padding: 16 };
const btn = { background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer" };
const ghost = { ...btn, background: "#334155" };
const input = { background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px" };

export default function Home() {
  const [tab, setTab] = useState("sbi");
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [typ, setTyp] = useState("");

  const endpoint = TABS.find((t) => t.id === tab).endpoint;

  async function upload() {
    if (!file) return setError("Choose a PDF first.");
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (password) fd.append("password", password);
      const r = await fetch(`${API}${endpoint}`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(`Backend ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.transactions || [];
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);

  const filtered = rows.filter(
    (r) =>
      (!q || `${r.description} ${r.UTR_No}`.toLowerCase().includes(q.toLowerCase())) &&
      (!cat || r.category === cat) &&
      (!typ || r.type === typ)
  );

  const totals = useMemo(() => {
    let credit = 0, debit = 0;
    for (const r of rows) {
      const a = Number(r.amount) || 0;
      if (r.type === "CREDIT") credit += a;
      else if (r.type === "DEBIT") debit += a;
    }
    return { credit, debit, net: credit - debit };
  }, [rows]);

  const stamp = new Date().toISOString().slice(0, 10);
  const dlJSON = () => download(`transactions_${tab}_${stamp}.json`, JSON.stringify(result, null, 2), "application/json");
  const dlCSV = () => download(`transactions_${tab}_${stamp}.csv`, toCSV(filtered), "text/csv");
  const dlXLSX = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtered.map((r) => Object.fromEntries(COLS.map((c) => [c, r[c] ?? ""]))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "transactions");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    download(`transactions_${tab}_${stamp}.xlsx`, new Blob([buf], { type: "application/octet-stream" }));
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Statement Parser</h1>

      <section style={{ ...card, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tab === t.id ? btn : ghost}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <input
            type="password"
            placeholder="PDF password (SBI, optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
          />
          <button onClick={upload} disabled={loading} style={btn}>
            {loading ? "Parsing…" : `Upload → ${API}${endpoint}`}
          </button>
        </div>
        {file && <small style={{ color: "#94a3b8" }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</small>}
        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
      </section>

      {result && (
        <>
          <section style={{ ...card, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <strong>
              {result.count} transactions · source: {result.source || tab}
            </strong>
            <span>Credit ₹{totals.credit.toLocaleString("en-IN")}</span>
            <span>Debit ₹{totals.debit.toLocaleString("en-IN")}</span>
            <span>Net ₹{totals.net.toLocaleString("en-IN")}</span>
            <span style={{ flex: 1 }} />
            <button onClick={dlJSON} style={ghost}>↓ JSON</button>
            <button onClick={dlCSV} style={ghost}>↓ CSV</button>
            <button onClick={dlXLSX} style={ghost}>↓ XLSX</button>
          </section>

          <section style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder="Search description / UTR…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} />
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={input}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={typ} onChange={(e) => setTyp(e.target.value)} style={input}>
              <option value="">DEBIT + CREDIT</option>
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <small style={{ color: "#94a3b8", alignSelf: "center" }}>
              showing {filtered.length}/{rows.length} (downloads use the filtered view, JSON keeps full response)
            </small>
          </section>

          <section style={{ ...card, overflowX: "auto", padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#0f172a" }}>
                  {["Date", "Time", "Description", "Type", "Amount", "Category", "UTR"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{(r.date || "").slice(0, 10)}</td>
                    <td style={{ padding: "6px 10px" }}>{r.time || ""}</td>
                    <td style={{ padding: "6px 10px" }}>{r.description}</td>
                    <td style={{ padding: "6px 10px", color: r.type === "CREDIT" ? "#4ade80" : "#f87171" }}>{r.type}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{Number(r.amount).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "6px 10px" }}>{r.category}</td>
                    <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{r.UTR_No}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <p style={{ padding: "0 16px", color: "#94a3b8" }}>…first 500 of {filtered.length} shown (downloads include all).</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
