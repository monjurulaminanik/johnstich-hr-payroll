import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jhonstitch HR & Payroll",
  description:
    "HR and payroll management for Jhonstitch Knitting & Dyeing — wages, attendance, overtime, and payslips.",
  icons: {
    icon: [
      { url: "/favicon.jpeg", type: "image/jpeg", sizes: "96x96" },
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
