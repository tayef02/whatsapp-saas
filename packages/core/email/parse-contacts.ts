import * as XLSX from "xlsx";
import type { RawContactRow } from "../contacts/parse";

const EMAIL_HEADERS = ["email", "e-mail", "email address", "mail", "ইমেইল", "ইমেল", "ই-মেইল"];
const NAME_HEADERS = ["name", "full name", "নাম"];

// Excel ফাইল (.xlsx = "PK" দিয়ে শুরু, .xls = D0 CF 11 E0) ছাড়া বাকি সব CSV/টেক্সট। SheetJS বাইট থেকে সরাসরি
// CSV পড়লে BOM ছাড়া UTF-8 ফাইলের বাংলা অক্ষর ভেঙে যায় (Google Sheets এর CSV এক্সপোর্টে BOM থাকে না),
// তাই CSV নিজে UTF-8 হিসেবে ডিকোড করে (BOM থাকলে বাদ দিয়ে) টেক্সট হিসেবে দেওয়া হয়
function readInput(buffer: ArrayBuffer): [string | ArrayBuffer, XLSX.ParsingOptions] {
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const isXlsx = head[0] === 0x50 && head[1] === 0x4b;
  const isXls = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  if (isXlsx || isXls) return [buffer, { type: "array" }];

  const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
  return [text, { type: "string" }];
}

// CSV বা Excel ফাইলের raw bytes থেকে রো গুলো বের করে — header নাম দেখে কোন কলাম ইমেইল আর
// কোনটা নাম বোঝে (case-insensitive)। ইমেইল কলাম না পেলে emailKey = null (ইম্পোর্ট বন্ধ হবে —
// প্রথম কলাম অনুমান করা হয় না, ভুল কলামকে ইমেইল ধরলে সব রো ইনভ্যালিড হতো)।
export function parseEmailContactFile(buffer: ArrayBuffer): {
  rows: RawContactRow[];
  emailKey: string | null;
  nameKey: string | null;
} {
  const workbook = XLSX.read(...readInput(buffer));
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = firstSheet ? XLSX.utils.sheet_to_json<RawContactRow>(firstSheet, { defval: "", raw: false }) : [];

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const emailKey = headers.find((h) => EMAIL_HEADERS.includes(h.trim().toLowerCase())) ?? null;
  const nameKey = headers.find((h) => NAME_HEADERS.includes(h.trim().toLowerCase())) ?? null;

  return { rows, emailKey, nameKey };
}
