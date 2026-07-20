import { NextResponse } from "next/server";
import {
  getDb,
  listEmployees,
  listPeriods,
  getSections,
  generatePayrollRun,
  getPayrollRun,
} from "@/lib/store";
import { summarizeLines } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const periods = listPeriods();
  const activePeriod = periods[0];
  let run = activePeriod ? getPayrollRun(activePeriod.id) : undefined;
  if (activePeriod && !run) {
    run = generatePayrollRun(activePeriod.id);
  }

  const employees = listEmployees();
  const sections = getSections();
  const summary = run ? summarizeLines(run.lines) : null;

  const attendanceRate =
    run && run.lines.length
      ? run.lines.reduce((s, l) => s + l.paidDays / Math.max(l.monthDays, 1), 0) /
        run.lines.length
      : 0;

  const wagesCount = employees.filter((e) => (e.payType || "wages") === "wages").length;
  const salaryCount = employees.filter((e) => e.payType === "salary").length;

  return NextResponse.json({
    company: db.company,
    period: activePeriod || null,
    stats: {
      employees: employees.length,
      wagesCount,
      salaryCount,
      sections: sections.length,
      netPayable: summary?.grand.netPayable || 0,
      otAmount: summary?.grand.otAmount || 0,
      totalSalary: summary?.grand.totalSalary || 0,
      advances: summary?.grand.advance || 0,
      attendanceRate,
      wagesNet: summary?.byPayType?.wages?.netPayable || 0,
      salaryNet: summary?.byPayType?.salary?.netPayable || 0,
    },
    sectionBreakdown: summary?.bySection || [],
    byPayType: summary?.byPayType || null,
    recentEmployees: employees.slice(0, 8),
  });
}
