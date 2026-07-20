"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/attendance", label: "Attendance", icon: FileSpreadsheet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand-block">
          <div className="brand-logo-wrap">
            <Image
              src="/logo-256.png"
              alt="Jhonstitch Knitting & Dyeing"
              width={48}
              height={48}
              className="brand-logo"
              priority
            />
          </div>
          <div>
            <p className="brand-name">Jhonstitch</p>
            <p className="brand-sub">HR & Payroll</p>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Main">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-brand">
            <Image
              src="/logo-256.png"
              alt=""
              width={36}
              height={36}
              className="sidebar-footer-logo"
            />
            <div>
              <p className="mill-chip">Knitting & Dyeing</p>
              <p className="mill-loc">Khadun · Rupshi · Narayanganj</p>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="topbar-brand">
            <Image
              src="/logo-256.png"
              alt="Jhonstitch"
              width={36}
              height={36}
              className="topbar-logo"
            />
            <div className="topbar-title">
              <span className="topbar-eyebrow">Jhonstitch Knitting & Dyeing</span>
              <strong>People · Pay · Precision</strong>
            </div>
          </div>
          <div className="topbar-pill">202 people · Wages + Salary loaded</div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
