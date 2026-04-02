"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Search,
  ChevronDown,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Users,
  Rows3,
} from "lucide-react";

interface VendorGroup {
  vendor: string;
  email: string;
  rows: Record<string, string>[];
}

interface ParseResult {
  vendors: VendorGroup[];
  totalEmails: number;
  totalRows: number;
  headers: string[];
}

interface SendResult {
  email: string;
  vendor: string;
  success: boolean;
  error?: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Animated background card cycle
  useEffect(() => {
    const interval = setInterval(() => setActiveCard((p) => (p + 1) % 4), 3000);
    return () => clearInterval(interval);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setError(""); setParsed(null); setSendResults(null); setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-excel", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to parse file"); return; }
      setParsed(data);
    } catch { setError("Failed to upload file"); }
    finally { setParsing(false); }
  }

  async function handleSend() {
    if (!parsed) return;
    setSending(true); setSendResults(null); setError("");
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors: parsed.vendors, headers: parsed.headers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send emails"); return; }
      setSendResults(data.results);
      const failed = (data.results as SendResult[]).filter((r) => !r.success);
      if (failed.length > 0 && parsed) {
        const failedEmails = new Set(failed.map((r) => r.email));
        const failedRows: Record<string, string>[] = [];
        for (const v of parsed.vendors) if (failedEmails.has(v.email)) failedRows.push(...v.rows);
        if (failedRows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(failedRows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Failed");
          XLSX.writeFile(wb, "failed-vendors.xlsx");
        }
      }
    } catch { setError("Failed to send emails"); }
    finally { setSending(false); }
  }

  function handleReset() {
    setFile(null); setParsed(null); setSendResults(null);
    setError(""); setSearch(""); setExpandedVendor(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const filteredVendors = useMemo(() => {
    if (!parsed) return [];
    if (!search.trim()) return parsed.vendors;
    const q = search.toLowerCase();
    return parsed.vendors.filter((v) => v.vendor.toLowerCase().includes(q) || v.email.toLowerCase().includes(q));
  }, [parsed, search]);

  const previewCols = parsed
    ? parsed.headers.filter((h) => !["vendor", "vendor name", "vendorname"].includes(h.toLowerCase()))
    : [];

  return (
    <>
      {/* Decorative floating cards */}
      <div className="deco-card deco-1" />
      <div className="deco-card deco-2" />
      <div className="deco-card deco-3" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Floating Nav */}
        <div className="flex justify-center pt-5 px-4 fade-up">
          <nav className="glass-nav px-5 py-3 flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Dentalkart" width={36} height={36} className="rounded-full" priority />
              <div className="leading-tight">
                <span className="text-base font-semibold text-gray-900">Dental<span className="text-[#E8913A]">kart</span></span>
                <span className="text-[10px] text-gray-400 block -mt-0.5">Accounts Team</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              <Mail className="w-3.5 h-3.5" />
              <span>Vendor Mailer</span>
            </div>
          </nav>
        </div>

        {/* Hero heading */}
        <div className="text-center pt-10 pb-6 px-4 fade-up fade-d1">
          <h1 className="text-4xl md:text-5xl font-thin text-gray-900 tracking-tight leading-tight">
            Send Invoices,<br />
            <span className="font-light">Effortlessly</span>
          </h1>
          <p className="text-sm text-gray-500 mt-3 font-light max-w-md mx-auto">
            Upload your vendor Excel and deliver invoice details to every vendor in one click.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 max-w-5xl mx-auto w-full">
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {sendResults ? (
          <div className="flex-1 flex items-start justify-center px-4 pt-4 fade-up">
            <div className="relative max-w-lg w-full">
              {/* Layered cards behind */}
              <div className="absolute inset-0 bg-[#2B8AC4] rounded-3xl rotate-3 scale-[0.97] opacity-20" />
              <div className="absolute inset-0 bg-[#E8913A] rounded-3xl -rotate-2 scale-[0.98] opacity-15" />
              <div className="relative card p-10 text-center">
                {(() => {
                  const sent = sendResults.filter((r) => r.success).length;
                  const failed = sendResults.filter((r) => !r.success).length;
                  return failed === 0 ? (
                    <>
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 border border-emerald-200 mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h2 className="text-2xl font-light text-gray-900 mb-1">All {sent} emails sent!</h2>
                      <p className="text-sm text-gray-400 mb-6">Invoice details delivered to all vendors</p>
                    </>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-orange-50 border border-orange-200 mb-4">
                        <AlertTriangle className="w-8 h-8 text-[#E8913A]" />
                      </div>
                      <h2 className="text-2xl font-light text-gray-900 mb-1">
                        <span className="text-emerald-500">{sent} sent</span> / <span className="text-red-400">{failed} failed</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6">Failed vendors saved as <span className="text-[#E8913A] font-medium">failed-vendors.xlsx</span></p>
                    </>
                  );
                })()}
                <button onClick={handleReset} className="btn-blue px-6 py-3 text-sm">Send Another File</button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Workspace — Animated card container */
          <div className="flex-1 px-4 pb-6 fade-up fade-d2">
            <div className="max-w-5xl mx-auto relative">
              {/* Animated layered background cards */}
              <div className={`absolute -inset-3 bg-[#E8913A] rounded-[28px] transition-all duration-1000 ease-in-out ${activeCard === 0 ? "rotate-[4deg] scale-[0.96] opacity-25" : "rotate-[3deg] scale-[0.95] opacity-15"}`} />
              <div className={`absolute -inset-3 bg-[#2B8AC4] rounded-[28px] transition-all duration-1000 ease-in-out ${activeCard === 1 ? "-rotate-[3deg] scale-[0.97] opacity-25" : "-rotate-[2deg] scale-[0.96] opacity-12"}`} />
              <div className={`absolute -inset-3 bg-[#a78bfa] rounded-[28px] transition-all duration-1000 ease-in-out ${activeCard === 2 ? "rotate-[2deg] scale-[0.98] opacity-20" : "rotate-[1deg] scale-[0.97] opacity-10"}`} />

              {/* Main content card */}
              <div className="relative z-10 card p-5">
                {/* Inner glass panel header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">Vendor Mailer</span>
                </div>

                {/* Two columns: Upload + Preview */}
                <div className="flex gap-4 min-h-[420px]">
                  {/* LEFT — Upload */}
                  <div className="w-[260px] flex-shrink-0 flex flex-col gap-3">
                    {/* Upload area */}
                    <div className="card-blue rounded-2xl p-4 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-7 w-7 rounded-xl bg-[#2B8AC4]/10 flex items-center justify-center">
                          <Upload className="w-3.5 h-3.5 text-[#2B8AC4]" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">Upload Excel</span>
                      </div>

                      <div
                        className="upload-zone p-5 text-center cursor-pointer"
                        onClick={() => fileRef.current?.click()}
                      >
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            setFile(e.target.files?.[0] || null);
                            setParsed(null); setSendResults(null); setError("");
                          }}
                          className="hidden"
                        />
                        {file ? (
                          <>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2B8AC4]/8 border border-[#2B8AC4]/15 mb-1">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-[#2B8AC4]" />
                              <span className="text-gray-700 text-xs font-medium truncate max-w-[140px]">{file.name}</span>
                            </div>
                            <p className="text-gray-400 text-[10px]">Click to change</p>
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="w-8 h-8 text-[#2B8AC4]/20 mx-auto mb-2" />
                            <p className="text-gray-400 text-xs">
                              Drop <span className="text-[#2B8AC4] font-medium">.xlsx</span> here
                            </p>
                          </>
                        )}
                      </div>

                      <button
                        onClick={handleUpload}
                        disabled={!file || parsing}
                        className={`btn-blue w-full mt-3 py-2.5 text-xs flex items-center justify-center gap-2 ${parsing ? "pulse-blue" : ""}`}
                      >
                        {parsing ? (
                          <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Parsing...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5" />Upload &amp; Preview</>
                        )}
                      </button>
                    </div>

                    {/* Stats — shown after parse */}
                    {parsed && (
                      <div className="card-orange rounded-2xl p-4 fade-up">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-xl bg-[#E8913A]/10 flex items-center justify-center">
                            <Rows3 className="w-3.5 h-3.5 text-[#E8913A]" />
                          </div>
                          <span className="text-sm font-semibold text-gray-800">Summary</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-[#2B8AC4]" /><span className="text-gray-500 text-xs">Vendors</span></div>
                            <span className="text-[#2B8AC4] font-bold text-sm">{parsed.totalEmails}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2"><FileSpreadsheet className="w-3.5 h-3.5 text-[#E8913A]" /><span className="text-gray-500 text-xs">Rows</span></div>
                            <span className="text-[#E8913A] font-bold text-sm">{parsed.totalRows}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-500 text-xs">Emails</span></div>
                            <span className="text-gray-800 font-bold text-sm">{parsed.totalEmails}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button onClick={handleReset} className="btn-ghost flex-1 py-2 text-xs flex items-center justify-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                          <button
                            onClick={handleSend}
                            disabled={sending}
                            className={`btn-orange flex-1 py-2 text-xs flex items-center justify-center gap-1 ${sending ? "pulse-blue" : ""}`}
                          >
                            {sending ? (
                              <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</>
                            ) : (
                              <><Send className="w-3 h-3" /> Send All</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT — Preview */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    {parsed ? (
                      <div className="bg-gray-50/80 rounded-2xl border border-gray-200/60 p-4 flex-1 flex flex-col min-h-0">
                        {/* Search */}
                        <div className="relative mb-3 flex-shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                          <input
                            type="text"
                            placeholder="Search vendor or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-[#2B8AC4]/40 focus:ring-2 focus:ring-[#2B8AC4]/10 transition-all"
                          />
                          {search && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{filteredVendors.length} found</span>}
                        </div>

                        {/* Vendor list */}
                        <div className="flex-1 overflow-y-auto rounded-xl bg-white border border-gray-100 divide-y divide-gray-100">
                          {filteredVendors.map((group, i) => {
                            const isExpanded = expandedVendor === group.email;
                            return (
                              <div key={i}>
                                <button
                                  onClick={() => setExpandedVendor(isExpanded ? null : group.email)}
                                  className="vendor-row w-full px-4 py-2.5 flex items-center gap-3 text-left"
                                >
                                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#2B8AC4]/10 to-[#E8913A]/5 flex items-center justify-center text-[#2B8AC4] text-xs font-bold flex-shrink-0">
                                    {group.vendor.charAt(0)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-gray-800 text-sm font-medium truncate">{group.vendor}</div>
                                    <div className="text-gray-400 text-xs truncate">{group.email}</div>
                                  </div>
                                  <span className="text-[#E8913A] text-[11px] font-medium bg-[#E8913A]/8 px-2 py-0.5 rounded-full flex-shrink-0">
                                    {group.rows.length} inv.
                                  </span>
                                  <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                </button>

                                {isExpanded && (
                                  <div className="px-4 pb-3">
                                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-[#2B8AC4]/5">
                                            {previewCols.map((col) => (
                                              <th key={col} className="px-3 py-2 text-left font-medium text-[#2B8AC4] text-[11px] uppercase tracking-wider whitespace-nowrap">
                                                {col}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.rows.map((row, j) => (
                                            <tr key={j} className="border-t border-gray-50 hover:bg-gray-50/50">
                                              {previewCols.map((col) => (
                                                <td key={col} className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{row[col] ?? ""}</td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {filteredVendors.length === 0 && (
                            <div className="px-4 py-10 text-center text-gray-300 text-sm">No vendors match &quot;{search}&quot;</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50/60 rounded-2xl border border-gray-200/40 flex-1 flex flex-col items-center justify-center">
                        <div className="h-14 w-14 rounded-2xl bg-white border border-gray-200/60 flex items-center justify-center mb-3 shadow-sm">
                          <FileSpreadsheet className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-gray-400 text-sm font-light">Upload an Excel to preview vendors</p>
                        <p className="text-gray-300 text-xs mt-1">.xlsx or .xls supported</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card indicators */}
            <div className="flex justify-center gap-1.5 mt-6">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveCard(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${activeCard === i ? "bg-gray-800 scale-125" : "bg-gray-300 hover:bg-gray-500"}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="py-3 text-center text-gray-400 text-[10px]">
          Dentalkart Accounts Team &middot; Internal Tool
        </footer>
      </div>
    </>
  );
}
