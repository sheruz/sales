/**
 * Minimal RFC4180-ish CSV parser (quoted fields, commas, newlines in quotes).
 */
export function parseCsvText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const records = parseCsvRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    // Skip fully empty rows
    if (values.every((v) => !v.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || (c === "\r" && s[i + 1] === "\n")) {
      if (c === "\r") i++;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\r") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

export function toErrorCsv(
  results: Array<{ row: number; status: string; reason?: string }>
): string {
  const failed = results.filter((r) => r.status === "failed" || r.status === "skipped");
  const lines = ["row,status,reason"];
  for (const r of failed) {
    const reason = (r.reason ?? "").replace(/"/g, '""');
    lines.push(`${r.row},${r.status},"${reason}"`);
  }
  return lines.join("\n");
}
