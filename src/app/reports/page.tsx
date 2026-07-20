"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBDTCurrency } from "@/lib/format";
import { downloadExcel, round2 } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import type { PayrollLine } from "@/lib/types";

const COLORS = [
  "#0096d6",
  "#c41e5a",
  "#2ea36a",
  "#e8912d",
  "#7b5ea7",
  "#0077b3",
  "#e8c44a",
  "#9b1848",
  "#4db6ac",
  "#f06292",
];

export default function ReportsPage() {
  const [periodId, setPeriodId] = useState("");
  const [periods, setPeriods] = useState<Array<{ id: string; label: string }>>([]);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [summary, setSummary] = useState<{
    bySection: Array<{
      section: string;
      count: number;
      totalSalary: number;
      otAmount: number;
      netPayable: number;
      advance: number;
      salary12?: number;
    }>;
    grand: {
      count: number;
      totalSalary: number;
      otAmount: number;
      netPayable: number;
      advance: number;
      canteen: number;
      salary12: number;
    };
  } | null>(null);

  useEffect(() => {
    fetch("/api/payroll")
      .then((r) => r.json())
      .then((d) => {
        setPeriods(d.periods || []);
        if (d.periods?.[0]) setPeriodId(d.periods[0].id);
      });
  }, []);

  useEffect(() => {
    if (!periodId) return;
    fetch(`/api/payroll?periodId=${periodId}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setLines(d.run?.lines || []);
      });
  }, [periodId]);

  if (!summary) return <div className="loading">Building section reports…</div>;

  const pieData = summary.bySection.map((s) => ({
    name: s.section,
    value: Math.round(s.netPayable),
  }));

  function exportExcel() {
    const sectionRows = summary!.bySection.map((s) => ({
      Section: s.section,
      Headcount: s.count,
      "Contract (12H)": round2(s.salary12 || 0),
      Earned: round2(s.totalSalary),
      OT: round2(s.otAmount),
      Advance: round2(s.advance),
      "Net Payable": round2(s.netPayable),
      "Avg Net": round2(s.netPayable / Math.max(s.count, 1)),
    }));
    sectionRows.push({
      Section: "GRAND TOTAL",
      Headcount: summary!.grand.count,
      "Contract (12H)": round2(summary!.grand.salary12),
      Earned: round2(summary!.grand.totalSalary),
      OT: round2(summary!.grand.otAmount),
      Advance: round2(summary!.grand.advance),
      "Net Payable": round2(summary!.grand.netPayable),
      "Avg Net": round2(summary!.grand.netPayable / Math.max(summary!.grand.count, 1)),
    });

    const detailRows = lines.map((l, i) => ({
      SL: i + 1,
      "Pay Type": l.payType === "salary" ? "Salary" : "Wages",
      Section: l.section,
      "Card No": l.cardNo,
      Name: l.name,
      Designation: l.designation,
      "Monthly (12H)": round2(l.salary12),
      Earned: round2(l.totalSalary),
      "OT Hours": l.otHours,
      "OT Amount": round2(l.otAmount),
      Advance: round2(l.advance),
      Canteen: round2(l.canteen),
      "Net Payable": round2(l.netPayable),
    }));

    downloadExcel(`Jhonstitch-Report-${periodId}`, [
      { name: "Section Ledger", rows: sectionRows },
      { name: "Employee Detail", rows: detailRows },
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Analytics</p>
          <h1>Payroll reports</h1>
          <p>Section-wise cost, overtime share, and headcount for management review.</p>
        </div>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "end" }}>
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
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <ExcelDownloadButton
            onClick={exportExcel}
            label="Download Excel"
            disabled={!lines.length}
          />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-label">Contract salary (12H)</p>
          <p className="stat-value">{formatBDTCurrency(summary.grand.salary12)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Earned + OT</p>
          <p className="stat-value">
            {formatBDTCurrency(summary.grand.totalSalary + summary.grand.otAmount)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Deductions</p>
          <p className="stat-value">
            {formatBDTCurrency(summary.grand.advance + summary.grand.canteen)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Net payout</p>
          <p className="stat-value">{formatBDTCurrency(summary.grand.netPayable)}</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Cost mix by section</h2>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatBDTCurrency(Number(v || 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>OT vs earned salary</h2>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.bySection.map((s) => ({
                    name: s.section.slice(0, 10),
                    earned: Math.round(s.totalSalary),
                    ot: Math.round(s.otAmount),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2eaec" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatBDTCurrency(Number(v || 0))} />
                  <Bar dataKey="earned" stackId="a" fill="#0096d6" />
                  <Bar dataKey="ot" stackId="a" fill="#c41e5a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h2>Section ledger</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th className="num">Headcount</th>
                <th className="num">Earned</th>
                <th className="num">OT</th>
                <th className="num">Advance</th>
                <th className="num">Net</th>
                <th className="num">Avg net</th>
              </tr>
            </thead>
            <tbody>
              {summary.bySection.map((s) => (
                <tr key={s.section}>
                  <td>
                    <strong>{s.section}</strong>
                  </td>
                  <td className="num">{s.count}</td>
                  <td className="num">{formatBDTCurrency(s.totalSalary)}</td>
                  <td className="num">{formatBDTCurrency(s.otAmount)}</td>
                  <td className="num">{formatBDTCurrency(s.advance)}</td>
                  <td className="num">
                    <strong>{formatBDTCurrency(s.netPayable)}</strong>
                  </td>
                  <td className="num">{formatBDTCurrency(s.netPayable / s.count)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>Grand total</strong>
                </td>
                <td className="num">
                  <strong>{summary.grand.count}</strong>
                </td>
                <td className="num">
                  <strong>{formatBDTCurrency(summary.grand.totalSalary)}</strong>
                </td>
                <td className="num">
                  <strong>{formatBDTCurrency(summary.grand.otAmount)}</strong>
                </td>
                <td className="num">
                  <strong>{formatBDTCurrency(summary.grand.advance)}</strong>
                </td>
                <td className="num">
                  <strong>{formatBDTCurrency(summary.grand.netPayable)}</strong>
                </td>
                <td className="num">
                  <strong>
                    {formatBDTCurrency(summary.grand.netPayable / summary.grand.count)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
