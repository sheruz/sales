import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("leads.create");
    const user = await requireOrganizationContext();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: "CSV file is required" } },
        { status: 400 }
      );
    }

    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: { message: "CSV must be under 2MB" } },
        { status: 400 }
      );
    }
    const name = (file.name || "").toLowerCase();
    if (name && !name.endsWith(".csv") && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
      return NextResponse.json(
        { success: false, error: { message: "Only CSV files are allowed" } },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "CSV file is empty or invalid" } },
        { status: 400 }
      );
    }
    if (rows.length > 5000) {
      return NextResponse.json(
        { success: false, error: { message: "CSV limited to 5000 rows" } },
        { status: 400 }
      );
    }

    const result = await leadService.importFromCsv(
      user.organizationId,
      rows,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
