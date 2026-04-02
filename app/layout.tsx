import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dentalkart Vendor Mailer",
  description: "Send invoice details to vendors via email",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-blobs">{children}</body>
    </html>
  );
}
