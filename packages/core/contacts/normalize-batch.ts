import { normalizeBangladeshiPhone } from "../utils/phone";
import type { RawContactRow } from "./parse";

export interface NormalizedContact {
  phone: string;
  name: string | null;
  custom_fields: Record<string, string>;
}

export interface NormalizeResult {
  valid: NormalizedContact[];
  invalidCount: number;
  duplicateInFileCount: number;
}

// raw রো গুলো থেকে phone/name বের করে নরমালাইজ করে, বাকি কলাম custom_fields এ রাখে।
// একই ফাইলে একই নাম্বার একাধিকবার থাকলে প্রথমটা রাখা হয়, বাকিগুলো duplicateInFileCount এ গোনা হয়।
export function normalizeContactRows(
  rows: RawContactRow[],
  phoneKey: string | null,
  nameKey: string | null
): NormalizeResult {
  const seen = new Map<string, NormalizedContact>();
  let invalidCount = 0;
  let duplicateInFileCount = 0;

  for (const row of rows) {
    const rawPhone = phoneKey ? row[phoneKey] : "";
    const phone = normalizeBangladeshiPhone(String(rawPhone ?? ""));

    if (!phone) {
      invalidCount++;
      continue;
    }

    if (seen.has(phone)) {
      duplicateInFileCount++;
      continue;
    }

    const customFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === phoneKey || key === nameKey) continue;
      if (value !== "") customFields[key] = String(value);
    }

    seen.set(phone, {
      phone,
      name: nameKey ? String(row[nameKey] ?? "").trim() || null : null,
      custom_fields: customFields,
    });
  }

  return { valid: Array.from(seen.values()), invalidCount, duplicateInFileCount };
}
