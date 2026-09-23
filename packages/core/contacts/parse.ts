import * as XLSX from "xlsx";

export type RawContactRow = Record<string, string>;

const PHONE_HEADERS = ["phone", "mobile", "number", "নাম্বার", "ফোন", "মোবাইল"];
const NAME_HEADERS = ["name", "নাম"];

// CSV বা Excel ফাইলের raw bytes থেকে রো গুলো বের করে — header নাম দেখে
// কোন কলাম phone আর কোনটা name বোঝার চেষ্টা করে (case-insensitive)
export function parseContactFile(buffer: ArrayBuffer): {
  rows: RawContactRow[];
  phoneKey: string | null;
  nameKey: string | null;
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawContactRow>(firstSheet, { defval: "", raw: false });

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const phoneKey = headers.find((h) => PHONE_HEADERS.includes(h.trim().toLowerCase())) ?? headers[0] ?? null;
  const nameKey = headers.find((h) => NAME_HEADERS.includes(h.trim().toLowerCase())) ?? null;

  return { rows, phoneKey, nameKey };
}
