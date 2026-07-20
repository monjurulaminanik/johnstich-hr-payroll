import { NextRequest, NextResponse } from "next/server";
import {
  listPeriods,
  createPeriod,
  getPeriod,
  getAttendance,
  saveAttendance,
  generatePayrollRun,
  getPayrollRun,
  finalizePeriod,
} from "@/lib/store";
import { daysInMonth, periodLabel, summarizeLines } from "@/lib/payroll";
import type { AttendanceEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get("periodId");
  const action = searchParams.get("action");

  if (!periodId) {
    return NextResponse.json({ periods: listPeriods() });
  }

  const period = getPeriod(periodId);
  if (!period) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  if (action === "attendance") {
    return NextResponse.json({ period, attendance: getAttendance(periodId) });
  }

  let run = getPayrollRun(periodId);
  if (!run) run = generatePayrollRun(periodId);
  const summary = summarizeLines(run.lines);

  return NextResponse.json({ period, run, summary });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action || "create";

  if (action === "create") {
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) {
      return NextResponse.json({ error: "year and month required" }, { status: 400 });
    }
    try {
      const period = createPeriod({
        label: periodLabel(year, month),
        year,
        month,
        monthDays: Number(body.monthDays) || daysInMonth(year, month),
      });
      return NextResponse.json({ period });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 400 }
      );
    }
  }

  if (action === "save-attendance") {
    const periodId = body.periodId as string;
    const entries = body.entries as AttendanceEntry[];
    try {
      saveAttendance(periodId, entries);
      const run = generatePayrollRun(periodId);
      return NextResponse.json({ ok: true, run, summary: summarizeLines(run.lines) });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 400 }
      );
    }
  }

  if (action === "generate") {
    const run = generatePayrollRun(body.periodId);
    return NextResponse.json({ run, summary: summarizeLines(run.lines) });
  }

  if (action === "finalize") {
    try {
      const period = finalizePeriod(body.periodId);
      return NextResponse.json({ period });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
