"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, RefreshCw, Printer } from "lucide-react";
import type { PayrollLine, PayrollPeriod } from "@/lib/types";
import { formatBDTCurrency } from "@/lib/format";
import { downloadExcel, round2 } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";

interface Summary {
  bySection: Array<{
    section: string;
    count: number;
    salary12: number;
    totalSalary: number;
    otAmount: number;
    advance: number;
    netPayable: number;
  }>;
  grand: {
    count: number;
    salary12: number;
    totalSalary: number;
    otAmount: number;
    advance: number;
    canteen: number;
    netPayable: number;
  };
}

export default function PayrollPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [section, setSection] = useState("");
  const [payType, setPayType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPeriods = useCallback(async () => {
    const res = await fetch("/api/payroll");
    const data = await res.json();
    const list: PayrollPeriod[] = data.periods || [];
    setPeriods(list);
    if (!periodId && list[0]) setPeriodId(list[0].id);
  }, [periodId]);

  const loadRun = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const res = await fetch(`/api/payroll?periodId=${periodId}`);
    const data = await res.json();
    setPeriod(data.period);
    setLines(data.run?.lines || []);
    setSummary(data.summary || null);
    setLoading(false);
  }, [periodId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  const sections = useMemo(
    () => Array.from(new Set(lines.map((l) => l.section))).sort(),
    [lines]
  );

  const filtered = useMemo(() => {
    return lines.filter((l) => {
      if (section && l.section !== section) return false;
      if (payType && (l.payType || "wages") !== payType) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        l.name.toLowerCase().includes(s) ||
        l.cardNo.includes(s) ||
        l.designation.toLowerCase().includes(s)
      );
    });
  }, [lines, section, payType, q]);

  async function regenerate() {
    await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", periodId }),
    });
    loadRun();
  }

  async function finalize() {
    if (!confirm("Finalize this payroll period? Attendance edits will be locked.")) return;
    await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize", periodId }),
    });
    loadPeriods();
    loadRun();
  }

  function exportExcel() {
    const detailRows = filtered.map((l, i) => ({
      SL: i + 1,
      "Pay Type": l.payType === "salary" ? "Salary" : "Wages",
      Section: l.section,
      "Card No": l.cardNo,
      "Employee Name": l.name,
      Designation: l.designation,
      "Bank Account": l.bankAccount,
      "Monthly (12H)": round2(l.salary12),
      "Base Pay (8H/Full)": round2(l.salary8),
      Basic: round2(l.basic),
      "House Rent": round2(l.houseRent),
      Medical: round2(l.medical),
      Conveyance: round2(l.conveyance),
      Food: round2(l.food),
      "Month Days": l.monthDays,
      "Present 12H": l.present12,
      "Present 8H": l.present8,
      Leave: l.leave,
      Absent: l.absent,
      "Paid Days": l.paidDays,
      "Earned Salary": round2(l.totalSalary),
      "OT Rate": round2(l.otRate),
      "OT Hours": l.otHours,
      "OT Amount": round2(l.otAmount),
      Advance: round2(l.advance),
      Canteen: round2(l.canteen),
      "Net Payable": round2(l.netPayable),
    }));

    const sectionRows = (summary?.bySection || []).map((s) => ({
      Section: s.section,
      Headcount: s.count,
      "Contract (12H)": round2(s.salary12),
      Earned: round2(s.totalSalary),
      OT: round2(s.otAmount),
      Advance: round2(s.advance),
      "Net Payable": round2(s.netPayable),
    }));

    if (summary) {
      sectionRows.push({
        Section: "GRAND TOTAL",
        Headcount: summary.grand.count,
        "Contract (12H)": round2(summary.grand.salary12),
        Earned: round2(summary.grand.totalSalary),
        OT: round2(summary.grand.otAmount),
        Advance: round2(summary.grand.advance),
        "Net Payable": round2(summary.grand.netPayable),
      });
    }

    downloadExcel(`Jhonstitch-Payroll-${periodId}`, [
      { name: "Payroll Detail", rows: detailRows },
      { name: "Section Summary", rows: sectionRows },
      {
        name: "Bank Transfer",
        rows: filtered
          .filter((l) => l.netPayable > 0)
          .map((l, i) => ({
            SL: i + 1,
            "Employee Name": l.name,
            "Card No": l.cardNo,
            "Bank Account": l.bankAccount || "",
            Section: l.section,
            "Pay Type": l.payType === "salary" ? "Salary" : "Wages",
            "Net Payable": round2(l.netPayable),
          })),
      },
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Monthly wages</p>
          <h1>Payroll register</h1>
          <p>
            Calculated from both Excel files: <strong>Wages</strong> (OT + 12H→8H) and{" "}
            <strong>Salary</strong> staff (full monthly, no OT).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <ExcelDownloadButton
            onClick={exportExcel}
            label="Download Excel"
            disabled={!filtered.length}
          />
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button type="button" className="btn btn-secondary" onClick={regenerate}>
            <RefreshCw size={16} /> Recalculate
          </button>
          {period?.status !== "finalized" && (
            <button type="button" className="btn btn-primary" onClick={finalize}>
              <Lock size={16} /> Finalize
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Employees on payroll</p>
            <p className="stat-value">{summary.grand.count}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Earned salary</p>
            <p className="stat-value">{formatBDTCurrency(summary.grand.totalSalary)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">OT amount</p>
            <p className="stat-value">{formatBDTCurrency(summary.grand.otAmount)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Net payable</p>
            <p className="stat-value">{formatBDTCurrency(summary.grand.netPayable)}</p>
          </div>
        </div>
      )}

      <div className="toolbar no-print">
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
                {p.label} ({p.status})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sec">Section</label>
          <select
            id="sec"
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
            placeholder="Find employee…"
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>
            {period?.label || "Payroll"}{" "}
            {period && (
              <span
                className={`badge ${period.status === "finalized" ? "badge-success" : "badge-gold"}`}
              >
                {period.status}
              </span>
            )}
          </h2>
          <Link href="/attendance" className="btn btn-ghost">
            Edit attendance →
          </Link>
        </div>
        <div className="table-wrap" style={{ maxHeight: "70vh" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Type</th>
                <th>Card</th>
                <th>Name</th>
                <th className="num">Monthly</th>
                <th className="num">Base</th>
                <th className="num">P8</th>
                <th className="num">Leave</th>
                <th className="num">Abs</th>
                <th className="num">Earned</th>
                <th className="num">OT Hr</th>
                <th className="num">OT Amt</th>
                <th className="num">Adv</th>
                <th className="num">Net</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15}>
                    <div className="loading">Calculating payroll…</div>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.employeeId}>
                    <td>
                      <span className="badge badge-teal">{l.section}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          l.payType === "salary" ? "badge-gold" : "badge-muted"
                        }`}
                      >
                        {l.payType === "salary" ? "Salary" : "Wages"}
                      </span>
                    </td>
                    <td>{l.cardNo}</td>
                    <td>
                      <strong>{l.name}</strong>
                      <div style={{ fontSize: "0.75rem", color: "#6b828c" }}>{l.designation}</div>
                    </td>
                    <td className="num">{formatBDTCurrency(l.salary12)}</td>
                    <td className="num">{formatBDTCurrency(l.salary8)}</td>
                    <td className="num">{l.payType === "salary" ? l.present12 : l.present8}</td>
                    <td className="num">{l.leave}</td>
                    <td className="num">{l.absent}</td>
                    <td className="num">{formatBDTCurrency(l.totalSalary)}</td>
                    <td className="num">{l.otHours}</td>
                    <td className="num">{formatBDTCurrency(l.otAmount)}</td>
                    <td className="num">{formatBDTCurrency(l.advance)}</td>
                    <td className="num">
                      <strong>{formatBDTCurrency(l.netPayable)}</strong>
                    </td>
                    <td className="no-print">
                      <Link
                        className="btn btn-ghost"
                        style={{ minHeight: 34, padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        href={`/payslips/${periodId}/${l.employeeId}`}
                      >
                        Slip
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary && !loading && (
              <tfoot>
                <tr>
                  <td colSpan={9}>
                    <strong>Grand total ({filtered.length} shown)</strong>
                  </td>
                  <td className="num">
                    <strong>{formatBDTCurrency(summary.grand.totalSalary)}</strong>
                  </td>
                  <td></td>
                  <td className="num">
                    <strong>{formatBDTCurrency(summary.grand.otAmount)}</strong>
                  </td>
                  <td className="num">
                    <strong>{formatBDTCurrency(summary.grand.advance)}</strong>
                  </td>
                  <td className="num">
                    <strong>{formatBDTCurrency(summary.grand.netPayable)}</strong>
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
