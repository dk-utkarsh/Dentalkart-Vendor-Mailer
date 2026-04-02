import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Excel file is empty" },
        { status: 400 }
      );
    }

    // Find email column (case-insensitive)
    const headers = Object.keys(rows[0]);
    const emailCol = headers.find(
      (h) => h.toLowerCase().replace(/[-_\s]/g, "") === "email"
    );

    if (!emailCol) {
      return NextResponse.json(
        { error: "No 'E-mail' or 'Email' column found in the Excel file" },
        { status: 400 }
      );
    }

    // Group rows by email
    const grouped: Record<
      string,
      { vendor: string; email: string; rows: Record<string, string>[] }
    > = {};

    for (const row of rows) {
      const email = (row[emailCol] || "").trim().toLowerCase();
      if (!email) continue;

      if (!grouped[email]) {
        // Find vendor column
        const vendorCol = headers.find(
          (h) =>
            h.toLowerCase() === "vendor" ||
            h.toLowerCase() === "vendor name" ||
            h.toLowerCase() === "vendorname"
        );
        grouped[email] = {
          vendor: vendorCol ? row[vendorCol] : "Unknown Vendor",
          email,
          rows: [],
        };
      }
      grouped[email].rows.push(row);
    }

    const vendors = Object.values(grouped);

    return NextResponse.json({
      vendors,
      totalEmails: vendors.length,
      totalRows: rows.length,
      headers: headers.filter(
        (h) => h.toLowerCase().replace(/[-_\s]/g, "") !== "email"
      ),
    });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse Excel file" },
      { status: 500 }
    );
  }
}
