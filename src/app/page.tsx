"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBDTCurrency } from "@/lib/format";
import { ArrowRight, Users, Building2, Wallet, Clock } from "lucide-react";
import { downloadExcel, round2 } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";

interface DashboardData {
  company: { name: string; address: string };
  period: { id: string; label: string; status: string } | null;
  stats: {
    employees: number;
    wagesCount: number;
    salaryCount: number;
    sections: number;
    netPayable: number;
    otAmount: number;
    totalSalary: number;
    advances: number;
    attendanceRate: number;
    wagesNet: number;
    salaryNet: number;
  };
  sectionBreakdown: Array<{
    section: string;
    count: number;
    netPayable: number;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="alert">
        {error}. Open Settings and click &quot;Reload Excel seed data&quot;.
      </div>
    );
  }

  if (!data) return <div className="loading">Loading mill workforce summary…</div>;

  const dash = data;
  const maxNet = Math.max(...dash.sectionBreakdown.map((s) => s.netPayable), 1);
  const chartData = dash.sectionBreakdown.map((s) => ({
    name: s.section.length > 14 ? `${s.section.slice(0, 12)}…` : s.section,
    full: s.section,
    net: Math.round(s.netPayable),
    headcount: s.count,
  }));

  function exportExcel() {
    const summaryRows = [
      { Metric: "Company", Value: dash.company.name },
      { Metric: "Address", Value: dash.company.address },
      { Metric: "Period", Value: dash.period?.label || "" },
      { Metric: "Active employees", Value: dash.stats.employees },
      { Metric: "Wages staff", Value: dash.stats.wagesCount },
      { Metric: "Salary staff", Value: dash.stats.salaryCount },
      { Metric: "Sections", Value: dash.stats.sections },
      { Metric: "Net payable", Value: round2(dash.stats.netPayable) },
      { Metric: "Wages net", Value: round2(dash.stats.wagesNet) },
      { Metric: "Salary net", Value: round2(dash.stats.salaryNet) },
      { Metric: "OT amount", Value: round2(dash.stats.otAmount) },
      { Metric: "Advances", Value: round2(dash.stats.advances) },
      {
        Metric: "Attendance rate %",
        Value: round2(dash.stats.attendanceRate * 100),
      },
    ];
    const sectionRows = dash.sectionBreakdown.map((s) => ({
      Section: s.section,
      Headcount: s.count,
      "Net Payable": round2(s.netPayable),
    }));
    downloadExcel(`Jhonstitch-Dashboard-${dash.period?.id || "summary"}`, [
      { name: "Summary", rows: summaryRows },
      { name: "By Section", rows: sectionRows },
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Workforce overview</p>
          <h1>{dash.company.name}</h1>
          <p>
            {dash.company.address} · Payroll period{" "}
            <strong>{dash.period?.label || "—"}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <ExcelDownloadButton onClick={exportExcel} label="Download Excel" />
          <Link href="/attendance" className="btn btn-secondary">
            Edit attendance
          </Link>
          <Link href="/payroll" className="btn btn-primary">
            Open payroll <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-label">
            <Users size={14} style={{ display: "inline", marginRight: 6 }} />
            Active employees
          </p>
          <p className="stat-value">{dash.stats.employees}</p>
          <p className="stat-hint">
            {dash.stats.wagesCount} wages · {dash.stats.salaryCount} salary ·{" "}
            {dash.stats.sections} sections
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">
            <Wallet size={14} style={{ display: "inline", marginRight: 6 }} />
            Net payable
          </p>
          <p className="stat-value">{formatBDTCurrency(dash.stats.netPayable)}</p>
          <p className="stat-hint">
            Wages {formatBDTCurrency(dash.stats.wagesNet)} · Salary{" "}
            {formatBDTCurrency(dash.stats.salaryNet)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">
            <Clock size={14} style={{ display: "inline", marginRight: 6 }} />
            Overtime cost
          </p>
          <p className="stat-value">{formatBDTCurrency(dash.stats.otAmount)}</p>
          <p className="stat-hint">
            Advances {formatBDTCurrency(dash.stats.advances)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">
            <Building2 size={14} style={{ display: "inline", marginRight: 6 }} />
            Attendance
          </p>
          <p className="stat-value">
            {(dash.stats.attendanceRate * 100).toFixed(1)}%
          </p>
          <p className="stat-hint">Average paid days / month days</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Net pay by section</h2>
            <span className="badge badge-teal">{dash.period?.label}</span>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7a8494" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#7a8494" }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatBDTCurrency(Number(value || 0))}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.full || ""
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e6e9f0",
                      boxShadow: "0 8px 24px rgba(27,36,48,0.08)",
                    }}
                  />
                  <Bar dataKey="net" fill="#0096d6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Section headcount & pay</h2>
          </div>
          <div className="panel-body">
            <div className="section-list">
              {dash.sectionBreakdown.map((s) => (
                <div key={s.section} className="section-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="section-meta">
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.section}
                      </strong>
                      <span className="badge badge-muted">{s.count}</span>
                    </div>
                    <div className="bar-track" style={{ marginTop: 6 }}>
                      <div
                        className="bar-fill"
                        style={{ width: `${(s.netPayable / maxNet) * 100}%` }}
                      />
                    </div>
                  </div>
                  <strong className="num" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {formatBDTCurrency(s.netPayable)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
