"use client";

import { useState } from "react";

type Row = { key: string; value: string };

function toRows(fields: Record<string, string>): Row[] {
  const rows = Object.entries(fields).map(([key, value]) => ({ key, value }));
  return rows.length > 0 ? rows : [{ key: "", value: "" }];
}

// {{city}}, {{order_id}} এর মতো টেমপ্লেট ভেরিয়েবলের ডাটা এখান থেকেই আসে —
// key টাই টেমপ্লেটে {{key}} হিসেবে ব্যবহার হবে, তাই বানান মিলিয়ে লেখা জরুরি
export default function CustomFieldsEditor({ initial }: { initial: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>(toRows(initial));

  function updateRow(index: number, field: "key" | "value", value: string) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((r) => [...r, { key: "", value: "" }]);
  }

  const jsonValue = JSON.stringify(
    Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]))
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <label>কাস্টম ফিল্ড (টেমপ্লেটে {"{{key}}"} হিসেবে ব্যবহার করা যাবে)</label>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            placeholder="key, যেমন: city"
            value={row.key}
            onChange={(e) => updateRow(i, "key", e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            type="text"
            placeholder="value, যেমন: সিলেট"
            value={row.value}
            onChange={(e) => updateRow(i, "value", e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            style={{ width: "auto", flex: "0 0 auto", background: "#eee", color: "#333", padding: "0 12px" }}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} style={{ fontSize: 13, background: "#f7f7f8", color: "#333" }}>
        + ফিল্ড যোগ করুন
      </button>
      <input type="hidden" name="customFields" value={jsonValue} />
    </div>
  );
}
