import * as XLSX from "xlsx";

// PDF/XLSX/CSV/TXT থেকে প্লেইন টেক্সট বের করে — pdf-parse শুধু worker এ (হালকা লাইব্রেরি
// না, web এর bundle এ টানার দরকার নেই)
export async function extractText(fileType: "pdf" | "xlsx" | "csv" | "txt", buffer: Buffer): Promise<string> {
  if (fileType === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (fileType === "txt") {
    return buffer.toString("utf-8");
  }

  // xlsx/csv দুটোই SheetJS দিয়ে পার্স করে — প্রতিটা row কে "Header: Value | Header: Value"
  // ফরম্যাটে একটা লাইনে বসানো হয় (raw CSV কমা দিয়ে জোড়া না দিয়ে), যাতে প্রতিটা row নিজে থেকেই
  // একটা সম্পূর্ণ, লেবেল-করা বাক্যের মতো হয় — embedding/chunking এ অনেক ভালো ফল দেয়
  // (raw CSV এ "P001,Wireless Mouse,Electronics,..." এর চেয়ে "Product ID: P001, Product
  // Name: Wireless Mouse, Category: Electronics, ..." embedding এর জন্য বেশি স্পষ্ট)
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    if (rows.length === 0) continue;

    const headers = (rows[0] as unknown[]).map((h) => String(h ?? "").trim());
    const lines: string[] = [];
    for (const row of rows.slice(1)) {
      const cells = row as unknown[];
      const labeled = headers
        .map((h, i) => (h && cells[i] !== undefined && cells[i] !== "" ? `${h}: ${cells[i]}` : null))
        .filter(Boolean);
      if (labeled.length > 0) lines.push(labeled.join(", "));
    }
    if (lines.length > 0) parts.push(`# ${sheetName}\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}
