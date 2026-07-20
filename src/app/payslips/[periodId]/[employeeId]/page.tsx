"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Printer, ArrowLeft } from "lucide-react";
import type { PayrollLine, PayrollPeriod } from "@/lib/types";
import { formatBDTCurrency, formatDate } from "@/lib/format";
import { downloadExcel, round2 } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";

export default function PayslipPage() {
  const params = useParams<{ periodId: string; employeeId: string }>();
  const [line, setLine] = useState<PayrollLine | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [company, setCompany] = useState({ name: "", address: "" });

  useEffect(() => {
    Promise.all([
      fetch(`/api/payroll?periodId=${params.periodId}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([payroll, settings]) => {
      setPeriod(payroll.period);
      setCompany(settings.company);
      const found = (payroll.run?.lines || []).find(
        (l: PayrollLine) => l.employeeId === params.employeeId
      );
      setLine(found || null);
    });
  }, [params.periodId, params.employeeId]);

  if (!line || !period) {
    return <div className="loading">Preparing payslip…</div>;
  }

  return (
    <div>
      <div className="toolbar no-print">
        <Link href="/payroll" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to payroll
        </Link>
        <ExcelDownloadButton
          label="Download Excel"
          onClick={() => {
            downloadExcel(`Jhonstitch-Payslip-${line.cardNo || line.name}`, [
              {
                name: "Payslip",
                rows: [
                  { Field: "Company", Value: company.name },
                  { Field: "Address", Value: company.address },
                  { Field: "Period", Value: period.label },
                  { Field: "Pay Type", Value: line.payType === "salary" ? "Salary" : "Wages" },
                  { Field: "Employee", Value: line.name },
                  { Field: "Card No", Value: line.cardNo },
                  { Field: "Designation", Value: line.designation },
                  { Field: "Section", Value: line.section },
                  { Field: "Bank Account", Value: line.bankAccount },
                  { Field: "Monthly (12H)", Value: round2(line.salary12) },
                  { Field: "Base Pay", Value: round2(line.salary8) },
                  { Field: "Basic", Value: round2(line.basic) },
                  { Field: "House Rent", Value: round2(line.houseRent) },
                  { Field: "Medical", Value: round2(line.medical) },
                  { Field: "Conveyance", Value: round2(line.conveyance) },
                  { Field: "Food", Value: round2(line.food) },
                  { Field: "Present 12H", Value: line.present12 },
                  { Field: "Present 8H", Value: line.present8 },
                  { Field: "Leave", Value: line.leave },
                  { Field: "Absent", Value: line.absent },
                  { Field: "Earned Salary", Value: round2(line.totalSalary) },
                  { Field: "OT Hours", Value: line.otHours },
                  { Field: "OT Amount", Value: round2(line.otAmount) },
                  { Field: "Advance", Value: round2(line.advance) },
                  { Field: "Canteen", Value: round2(line.canteen) },
                  { Field: "Net Payable", Value: round2(line.netPayable) },
                ],
              },
            ]);
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Print payslip
        </button>
      </div>

      <article className="payslip">
        <div className="payslip-brand">
          <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
            <Image
              src="/logo-256.png"
              alt="Jhonstitch"
              width={64}
              height={64}
              className="payslip-logo"
              style={{ objectFit: "contain" }}
            />
            <div>
              <h2>{company.name}</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#3a5560" }}>{company.address}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="badge badge-gold">Payslip</span>
            <p style={{ margin: "0.4rem 0 0", fontWeight: 700 }}>{period.label}</p>
          </div>
        </div>

        <dl className="kv-grid">
          <div>
            <dt>Employee</dt>
            <dd>{line.name}</dd>
          </div>
          <div>
            <dt>Card no</dt>
            <dd>{line.cardNo}</dd>
          </div>
          <div>
            <dt>Designation</dt>
            <dd>{line.designation}</dd>
          </div>
          <div>
            <dt>Section</dt>
            <dd>{line.section}</dd>
          </div>
          <div>
            <dt>Bank account</dt>
            <dd>{line.bankAccount || "—"}</dd>
          </div>
          <div>
            <dt>Month days</dt>
            <dd>{line.monthDays}</dd>
          </div>
        </dl>

        <div className="split">
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem" }}>
              Salary structure
            </h3>
            <div className="money-row">
              <span>Monthly (12H)</span>
              <span>{formatBDTCurrency(line.salary12, 2)}</span>
            </div>
            <div className="money-row">
              <span>Monthly (8H)</span>
              <span>{formatBDTCurrency(line.salary8, 2)}</span>
            </div>
            <div className="money-row">
              <span>Basic</span>
              <span>{formatBDTCurrency(line.basic, 2)}</span>
            </div>
            <div className="money-row">
              <span>House rent</span>
              <span>{formatBDTCurrency(line.houseRent, 2)}</span>
            </div>
            <div className="money-row">
              <span>Medical</span>
              <span>{formatBDTCurrency(line.medical, 2)}</span>
            </div>
            <div className="money-row">
              <span>Conveyance</span>
              <span>{formatBDTCurrency(line.conveyance, 2)}</span>
            </div>
            <div className="money-row">
              <span>Food</span>
              <span>{formatBDTCurrency(line.food, 2)}</span>
            </div>
          </div>

          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem" }}>
              Attendance & pay
            </h3>
            <div className="money-row">
              <span>Present 8H / 12H</span>
              <span>
                {line.present8} / {line.present12}
              </span>
            </div>
            <div className="money-row">
              <span>Leave / Absent</span>
              <span>
                {line.leave} / {line.absent}
              </span>
            </div>
            <div className="money-row">
              <span>Earned salary</span>
              <span>{formatBDTCurrency(line.totalSalary, 2)}</span>
            </div>
            <div className="money-row">
              <span>
                OT ({line.otHours}h × {formatBDTCurrency(line.otRate, 2)})
              </span>
              <span>{formatBDTCurrency(line.otAmount, 2)}</span>
            </div>
            <div className="money-row">
              <span>Advance</span>
              <span>- {formatBDTCurrency(line.advance, 2)}</span>
            </div>
            <div className="money-row">
              <span>Canteen</span>
              <span>- {formatBDTCurrency(line.canteen, 2)}</span>
            </div>
            <div className="money-row total">
              <span>Net payable</span>
              <span>{formatBDTCurrency(line.netPayable, 2)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "2.5rem",
            gap: "2rem",
          }}
        >
          <div style={{ flex: 1, borderTop: "1px solid #d5e0e4", paddingTop: "0.5rem" }}>
            <small style={{ color: "#6b828c" }}>Employee signature</small>
          </div>
          <div style={{ flex: 1, borderTop: "1px solid #d5e0e4", paddingTop: "0.5rem" }}>
            <small style={{ color: "#6b828c" }}>Authorized signature</small>
          </div>
        </div>

        <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "#6b828c" }}>
          Generated {formatDate(new Date().toISOString())} · Jhonstitch HR & Payroll
        </p>
      </article>
    </div>
  );
}
