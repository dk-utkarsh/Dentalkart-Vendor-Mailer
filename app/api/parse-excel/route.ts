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

    // Find the actual header row — skip empty rows at the top
    const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
    });

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i];
      if (row && row.some((cell) => {
        const val = (cell || "").toString().toLowerCase().replace(/[-_\s]/g, "");
        return val === "email" || val === "vendor" || val === "invno";
      })) {
        headerRowIdx = i;
        break;
      }
    }

    // Re-parse using the correct header row range
    const ref = sheet["!ref"];
    if (!ref) {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });
    }
    const range = XLSX.utils.decode_range(ref);
    range.s.r = headerRowIdx; // start from header row
    sheet["!ref"] = XLSX.utils.encode_range(range);

    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Excel file is empty" },
        { status: 400 }
      );
    }

    // Filter out rows where all values are empty
    const validRows = rows.filter((row) =>
      Object.values(row).some((v) => v && v.toString().trim() !== "")
    );

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "Excel file has no data rows" },
        { status: 400 }
      );
    }

    // Find email column (case-insensitive)
    const headers = Object.keys(validRows[0]);
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

    for (const row of validRows) {
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
      totalRows: validRows.length,
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
