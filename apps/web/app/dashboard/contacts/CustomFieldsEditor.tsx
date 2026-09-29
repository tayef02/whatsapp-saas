"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

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
    <div>
      <span className="mb-1.5 block text-sm font-medium text-text">কাস্টম ফিল্ড (টেমপ্লেটে {"{{key}}"} হিসেবে ব্যবহার করা যাবে)</span>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              placeholder="key, যেমন: city"
              value={row.key}
              onChange={(e) => updateRow(i, "key", e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="value, যেমন: সিলেট"
              value={row.value}
              onChange={(e) => updateRow(i, "value", e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded-lg border border-border px-2.5 text-text-muted hover:bg-gray-50"
              aria-label="মুছুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> ফিল্ড যোগ করুন
      </button>
      <input type="hidden" name="customFields" value={jsonValue} />
    </div>
  );
}
