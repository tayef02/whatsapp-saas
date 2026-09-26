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

  // xlsx/csv দুটোই SheetJS দিয়ে পার্স করে প্রতিটা শিট কে readable টেক্সট বানানো হয়
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`# ${sheetName}\n${csv}`);
  }
  return parts.join("\n\n");
}
