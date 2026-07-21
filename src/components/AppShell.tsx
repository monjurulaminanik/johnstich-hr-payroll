"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/attendance", label: "Attendance", icon: FileSpreadsheet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface User {
  email: string;
  name: string;
  role: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [headcount, setHeadcount] = useState("202");

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUser(d.user));
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.stats?.employees && setHeadcount(String(d.stats.employees)));
  }, [pathname]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AD";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand-block">
          <div className="brand-logo-wrap">
            <Image
              src="/logo-256.png"
              alt="Jhonstitch Knitting & Dyeing"
              width={44}
              height={44}
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
            <X size={20} strokeWidth={1.75} />
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
                <span className="nav-icon-wrap">
                  <Icon size={19} strokeWidth={1.75} />
                </span>
                <span>{item.label}</span>
                {active && <span className="nav-active-dot" />}
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
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="topbar-brand">
            <Image
              src="/logo-256.png"
              alt="Jhonstitch"
              width={34}
              height={34}
              className="topbar-logo"
            />
            <div className="topbar-title">
              <span className="topbar-eyebrow">Jhonstitch</span>
              <strong>People & Pay</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-pill">
              <span className="topbar-pill-dot" />
              {headcount} people · Live
            </div>

            <div className="user-menu">
              <button
                type="button"
                className="user-menu-btn"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
              >
                <span className="user-avatar">{initials}</span>
                <span className="user-info">
                  <strong>{user?.name || "Admin"}</strong>
                  <small>{user?.email || "admin@gmail.com"}</small>
                </span>
                <ChevronDown size={16} className={userOpen ? "rotated" : ""} />
              </button>
              {userOpen && (
                <>
                  <button
                    type="button"
                    className="user-menu-backdrop"
                    onClick={() => setUserOpen(false)}
                    aria-label="Close menu"
                  />
                  <div className="user-dropdown">
                    <button type="button" className="user-dropdown-item" onClick={logout}>
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
