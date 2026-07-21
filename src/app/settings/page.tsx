"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Plus } from "lucide-react";
import { daysInMonth } from "@/lib/payroll";

export default function SettingsPage() {
  const [company, setCompany] = useState({ name: "", address: "", brandShort: "" });
  const [allowances, setAllowances] = useState({ medical: 750, conveyance: 450, food: 1250 });
  const [settings, setSettings] = useState({ otDivisor: 208, currency: "BDT" });
  const [sections, setSections] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(7);
  const [health, setHealth] = useState<{
    employees?: number;
    wages?: number;
    salary?: number;
    attendance?: number;
    database?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setCompany(d.company);
        setAllowances(d.allowances);
        setSettings(d.settings);
        setSections(d.sections || []);
        setHealth(d.health || null);
      });
  }, []);

  async function reloadSeed() {
    if (!confirm("Reload all data from Wages-2026 Excel export? Unsaved edits will be replaced.")) {
      return;
    }
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-seed" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Seed failed");
      return;
    }
    setMessage(
      `MongoDB seeded: ${data.employees} employees, ${data.attendance} attendance rows, ${data.payrollLines} payroll lines (${data.periods} period). Storage: ${data.storage}.`
    );
    const refreshed = await fetch("/api/settings").then((r) => r.json());
    setCompany(refreshed.company);
    setAllowances(refreshed.allowances);
    setSettings(refreshed.settings);
    setSections(refreshed.sections || []);
    setHealth(refreshed.health || null);
  }

  async function createPeriod() {
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        year,
        month,
        monthDays: daysInMonth(year, month),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create period");
      return;
    }
    setMessage(`Created payroll period ${data.period.label}. Open Attendance to fill days.`);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Configuration</p>
          <h1>Settings</h1>
          <p>Company profile, Bangladesh garment wage formulas, and payroll periods.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reloadSeed}>
          <RotateCcw size={16} /> Reload Excel seed data
        </button>
      </div>

      {message && <div className="alert">{message}</div>}

      {health && (
        <div className="alert" style={{ marginBottom: "1rem" }}>
          Storage: <strong>MongoDB</strong> · {health.employees} employees (
          {health.wages} wages + {health.salary} salary) · {health.attendance} attendance rows
        </div>
      )}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Company</h2>
          </div>
          <div className="panel-body">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1.1rem",
                padding: "0.85rem",
                borderRadius: 12,
                background: "#f7fbfb",
                border: "1px solid var(--line)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-256.png"
                alt="Jhonstitch company logo"
                width={72}
                height={72}
                style={{ objectFit: "contain", background: "white", borderRadius: 12 }}
              />
              <div>
                <strong style={{ fontFamily: "var(--font-display)" }}>Official brand mark</strong>
                <p style={{ margin: "0.25rem 0 0", color: "#3a5560", fontSize: "0.88rem" }}>
                  Optimized from Favicon.jpeg — used as favicon + company logo across the app.
                </p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Legal name</label>
                <input value={company.name} readOnly />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Address</label>
                <input value={company.address} readOnly />
              </div>
            </div>
            <p style={{ marginTop: "1rem", color: "#3a5560", fontSize: "0.9rem" }}>
              Seeded from <strong>Wages-2026.xlsm</strong> + <strong>Salary-2026.xlsm</strong>.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Payroll formulas</h2>
          </div>
          <div className="panel-body">
            <div className="money-row">
              <span>Wages staff</span>
              <strong>12H→8H · OT ÷ 208 · P12+P8+Leave</strong>
            </div>
            <div className="money-row">
              <span>Salary staff</span>
              <strong>Full monthly · No OT · Present+Leave</strong>
            </div>
            <div className="money-row">
              <span>Allowances</span>
              <strong>
                Med {allowances.medical} · Conv {allowances.conveyance} · Food {allowances.food}
              </strong>
            </div>
            <div className="money-row">
              <span>Basic / House rent</span>
              <strong>2/3 and 1/3 of (base − allowances)</strong>
            </div>
            <div className="money-row">
              <span>OT rate (wages only)</span>
              <strong>8H salary ÷ {settings.otDivisor}</strong>
            </div>
            <div className="money-row total">
              <span>Net payable</span>
              <strong>Earned + OT − Advance − Canteen</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <section className="panel">
          <div className="panel-head">
            <h2>New payroll period</h2>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="year">Year</label>
                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="month">Month</label>
                <select
                  id="month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={createPeriod}
            >
              <Plus size={16} /> Create period
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Active sections ({sections.length})</h2>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {sections.map((s) => (
                <span key={s} className="badge badge-teal">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
