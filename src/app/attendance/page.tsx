"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { AttendanceEntry, Employee, PayrollPeriod } from "@/lib/types";
import { downloadExcel } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";

export default function AttendancePage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [section, setSection] = useState("");
  const [payType, setPayType] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [pRes, eRes] = await Promise.all([
      fetch("/api/payroll"),
      fetch("/api/employees"),
    ]);
    const pData = await pRes.json();
    const eData = await eRes.json();
    const list: PayrollPeriod[] = pData.periods || [];
    setPeriods(list);
    setEmployees((eData.employees || []).filter((e: Employee) => e.status === "active"));
    if (!periodId && list[0]) setPeriodId(list[0].id);
  }, [periodId]);

  const loadAttendance = useCallback(async () => {
    if (!periodId) return;
    const res = await fetch(`/api/payroll?periodId=${periodId}&action=attendance`);
    const data = await res.json();
    setPeriod(data.period);
    setEntries(data.attendance || []);
  }, [periodId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const sections = useMemo(
    () => Array.from(new Set(employees.map((e) => e.section))).sort(),
    [employees]
  );

  const rows = useMemo(() => {
    return entries
      .map((a) => ({ attendance: a, employee: empMap.get(a.employeeId) }))
      .filter((r) => r.employee)
      .filter((r) => !section || r.employee!.section === section)
      .filter((r) => !payType || (r.employee!.payType || "wages") === payType)
      .filter((r) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          r.employee!.name.toLowerCase().includes(s) ||
          r.employee!.cardNo.includes(s)
        );
      })
      .sort(
        (a, b) =>
          a.employee!.section.localeCompare(b.employee!.section) ||
          a.employee!.name.localeCompare(b.employee!.name)
      );
  }, [entries, empMap, section, payType, q]);

  function updateEntry(employeeId: string, patch: Partial<AttendanceEntry>) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.employeeId !== employeeId) return e;
        const next = { ...e, ...patch };
        if (period) {
          const paid = (next.present12 || 0) + (next.present8 || 0) + (next.leave || 0);
          next.absent = Math.max(0, period.monthDays - paid);
        }
        return next;
      })
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-attendance",
        periodId,
        entries,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage(
      `Saved. Payroll recalculated — net payable ৳ ${Math.round(
        data.summary?.grand?.netPayable || 0
      ).toLocaleString("en-BD")}`
    );
  }

  const locked = period?.status === "finalized";

  function exportExcel() {
    const excelRows = rows.map(({ attendance: a, employee: emp }, i) => ({
      SL: i + 1,
      "Pay Type": emp!.payType === "salary" ? "Salary" : "Wages",
      Section: emp!.section,
      "Card No": emp!.cardNo,
      "Employee Name": emp!.name,
      Designation: emp!.designation,
      "Present 12H": a.present12,
      "Present 8H": a.present8,
      Leave: a.leave,
      Absent: a.absent,
      "OT Hours": a.otHours,
      Advance: a.advance,
      Canteen: a.canteen,
      "Month Days": period?.monthDays ?? "",
      Period: period?.label ?? periodId,
    }));
    downloadExcel(`Jhonstitch-Attendance-${periodId}`, [
      { name: "Attendance", rows: excelRows },
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Daily presence & OT</p>
          <h1>Attendance sheet</h1>
          <p>
            Present (12H/8H), leave, absent, OT hours, advance and canteen deductions — same
            columns as your wages Excel.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <ExcelDownloadButton
            onClick={exportExcel}
            label="Download Excel"
            disabled={!rows.length}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving || locked}
          >
            <Save size={16} /> {saving ? "Saving…" : "Save & recalculate"}
          </button>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}
      {locked && (
        <div className="alert">This period is finalized. Re-open only via a new draft period.</div>
      )}

      <div className="toolbar">
        <div className="field">
          <label htmlFor="period">Period</label>
          <select
            id="period"
            className="select-input"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.monthDays} days
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="section">Section</label>
          <select
            id="section"
            className="select-input"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">All</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payType">Pay type</label>
          <select
            id="payType"
            className="select-input"
            value={payType}
            onChange={(e) => setPayType(e.target.value)}
          >
            <option value="">All</option>
            <option value="wages">Wages</option>
            <option value="salary">Salary</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="q">Search</label>
          <input
            id="q"
            className="search-input"
            style={{ maxWidth: "100%" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{rows.length} employees</h2>
          <span className="badge badge-muted">Month days: {period?.monthDays ?? "—"}</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: "70vh" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Name</th>
                <th>Type</th>
                <th>Section</th>
                <th className="num">P12</th>
                <th className="num">P8</th>
                <th className="num">Leave</th>
                <th className="num">Absent</th>
                <th className="num">OT Hrs</th>
                <th className="num">Advance</th>
                <th className="num">Canteen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ attendance: a, employee: emp }) => {
                const isSalary = emp!.payType === "salary";
                return (
                <tr key={a.employeeId}>
                  <td>{emp!.cardNo}</td>
                  <td>
                    <strong>{emp!.name}</strong>
                  </td>
                  <td>
                    <span className={`badge ${isSalary ? "badge-gold" : "badge-muted"}`}>
                      {isSalary ? "Salary" : "Wages"}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-teal">{emp!.section}</span>
                  </td>
                  {(
                    [
                      ["present12", a.present12],
                      ["present8", a.present8],
                      ["leave", a.leave],
                      ["absent", a.absent],
                      ["otHours", a.otHours],
                      ["advance", a.advance],
                      ["canteen", a.canteen],
                    ] as const
                  ).map(([key, value]) => (
                    <td key={key} className="num">
                      <input
                        type="number"
                        min={0}
                        disabled={
                          locked ||
                          key === "absent" ||
                          (isSalary && (key === "present8" || key === "otHours"))
                        }
                        value={isSalary && (key === "present8" || key === "otHours") ? 0 : value}
                        onChange={(e) =>
                          updateEntry(a.employeeId, { [key]: Number(e.target.value) || 0 })
                        }
                        style={{
                          width: key === "advance" || key === "canteen" ? 88 : 64,
                          textAlign: "right",
                          minHeight: 36,
                          padding: "0.3rem 0.4rem",
                          opacity: isSalary && (key === "present8" || key === "otHours") ? 0.45 : 1,
                        }}
                        aria-label={`${emp!.name} ${key}`}
                      />
                    </td>
                  ))}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
