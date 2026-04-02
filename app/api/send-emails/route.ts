import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VendorGroup {
  vendor: string;
  email: string;
  rows: Record<string, string>[];
}

export async function POST(req: NextRequest) {
  try {
    const { vendors, headers } = (await req.json()) as {
      vendors: VendorGroup[];
      headers: string[];
    };

    if (!vendors || vendors.length === 0) {
      return NextResponse.json(
        { error: "No vendor data provided" },
        { status: 400 }
      );
    }

    const zohoEmail = process.env.ZOHO_EMAIL;
    const zohoPassword = process.env.ZOHO_PASSWORD;

    if (!zohoEmail || !zohoPassword) {
      return NextResponse.json(
        { error: "Zoho SMTP credentials not configured" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.in",
      port: 465,
      secure: true,
      auth: {
        user: zohoEmail,
        pass: zohoPassword,
      },
    });

    // Display columns: exclude email and vendor from table (already in greeting)
    const tableCols = headers.filter(
      (h) =>
        h.toLowerCase() !== "vendor" &&
        h.toLowerCase() !== "vendor name" &&
        h.toLowerCase() !== "vendorname"
    );

    // Read logo for CID attachment
    const logoPath = join(process.cwd(), "public", "logo-email.png");
    const logoBuffer = readFileSync(logoPath);

    const results: { email: string; vendor: string; success: boolean; error?: string }[] = [];

    for (const group of vendors) {
      const tableRows = group.rows
        .map(
          (row, idx) =>
            `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f0f7fc"};">${tableCols.map((col) => `<td style="border:1px solid #d6e4f0;padding:10px 12px;color:#333333;font-size:13px;">${row[col] ?? ""}</td>`).join("")}</tr>`
        )
        .join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#2B8AC4;padding:28px 30px;text-align:center;">
            <img src="cid:dentalkart-logo" alt="Dentalkart" width="120" height="120" style="display:block;margin:0 auto;border-radius:50%;background:#ffffff;border:none;outline:none;"/>
          </td>
        </tr>

        <!-- Orange accent bar -->
        <tr>
          <td style="background:#E8913A;height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:30px;">
            <p style="font-size:16px;color:#333;margin:0 0 6px;">Dear <strong style="color:#2B8AC4;">${group.vendor}</strong>,</p>
            <p style="font-size:14px;color:#555;margin:0 0 20px;">Please find below your invoice details:</p>

            <!-- Invoice Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d6e4f0;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#2B8AC4;">
                  ${tableCols.map((col) => `<th style="padding:10px 12px;text-align:left;color:#ffffff;font-size:13px;font-weight:600;border:1px solid #2480b0;">${col}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 30px;border-top:1px solid #e8e8e8;">
            <p style="font-size:14px;color:#555;margin:0 0 4px;">Warm Regards,</p>
            <p style="font-size:15px;color:#2B8AC4;font-weight:bold;margin:0 0 8px;">Dentalkart Accounts Team</p>
            <p style="font-size:12px;color:#999;margin:0;">
              <a href="https://www.dentalkart.com" style="color:#E8913A;text-decoration:none;">www.dentalkart.com</a>
            </p>
          </td>
        </tr>

        <!-- Bottom orange bar -->
        <tr>
          <td style="background:#E8913A;height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      try {
        await transporter.sendMail({
          from: `"Dentalkart Accounts" <${zohoEmail}>`,
          to: group.email,
          subject: `Dentalkart - Invoice Details for ${group.vendor}`,
          html,
          attachments: [
            {
              filename: "logo.png",
              content: logoBuffer,
              cid: "dentalkart-logo",
            },
          ],
        });
        results.push({ email: group.email, vendor: group.vendor, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ email: group.email, vendor: group.vendor, success: false, error: message });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Send one summary email to CC recipients with all vendor data
    const ccRecipients = ["accounts1@dentalkart.com", "accounts7@dentalkart.com"];

    const allVendorSections = vendors
      .map((group) => {
        const rows = group.rows
          .map(
            (row, idx) =>
              `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f0f7fc"};">${tableCols.map((col) => `<td style="border:1px solid #d6e4f0;padding:8px 10px;color:#333;font-size:12px;">${row[col] ?? ""}</td>`).join("")}</tr>`
          )
          .join("");

        const status = results.find((r) => r.email === group.email);
        const statusBadge = status?.success
          ? `<span style="color:#16a34a;font-size:12px;font-weight:600;">Sent</span>`
          : `<span style="color:#dc2626;font-size:12px;font-weight:600;">Failed</span>`;

        return `
          <tr><td style="padding:20px 30px 5px;">
            <p style="font-size:15px;margin:0 0 4px;">
              <strong style="color:#2B8AC4;">${group.vendor}</strong>
              <span style="color:#888;font-size:12px;margin-left:8px;">${group.email}</span>
              <span style="margin-left:8px;">${statusBadge}</span>
            </p>
          </td></tr>
          <tr><td style="padding:0 30px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #d6e4f0;">
              <thead>
                <tr style="background:#2B8AC4;">
                  ${tableCols.map((col) => `<th style="padding:8px 10px;text-align:left;color:#fff;font-size:12px;font-weight:600;border:1px solid #2480b0;">${col}</th>`).join("")}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td></tr>`;
      })
      .join("");

    const summaryHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#2B8AC4;padding:28px 30px;text-align:center;">
            <img src="cid:dentalkart-logo" alt="Dentalkart" width="120" height="120" style="display:block;margin:0 auto;border-radius:50%;background:#ffffff;border:none;outline:none;"/>
          </td>
        </tr>
        <tr><td style="background:#E8913A;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:25px 30px 10px;">
          <p style="font-size:18px;color:#333;margin:0 0 4px;font-weight:bold;">Vendor Email Summary</p>
          <p style="font-size:13px;color:#888;margin:0 0 6px;">${sent} sent, ${failed} failed &mdash; ${vendors.length} vendors total</p>
        </td></tr>
        ${allVendorSections}
        <tr>
          <td style="background:#f8f9fa;padding:20px 30px;border-top:1px solid #e8e8e8;">
            <p style="font-size:14px;color:#555;margin:0 0 4px;">Warm Regards,</p>
            <p style="font-size:15px;color:#2B8AC4;font-weight:bold;margin:0 0 8px;">Dentalkart Accounts Team</p>
            <p style="font-size:12px;color:#999;margin:0;">
              <a href="https://www.dentalkart.com" style="color:#E8913A;text-decoration:none;">www.dentalkart.com</a>
            </p>
          </td>
        </tr>
        <tr><td style="background:#E8913A;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: `"Dentalkart Accounts" <${zohoEmail}>`,
        to: ccRecipients,
        subject: `Dentalkart - Vendor Invoice Summary (${sent} sent, ${failed} failed)`,
        html: summaryHtml,
        attachments: [
          { filename: "logo.png", content: logoBuffer, cid: "dentalkart-logo" },
        ],
      });
    } catch (err) {
      console.error("Summary email failed:", err);
    }

    return NextResponse.json({ results, sent, failed });
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}
