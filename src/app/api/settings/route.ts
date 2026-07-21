import { NextResponse } from "next/server";
import {
  getDbSnapshot,
  getSections,
  resetFromSeed,
  updateMeta,
  mongoHealth,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDbSnapshot();
  const health = await mongoHealth();
  return NextResponse.json({
    company: db.company,
    allowances: db.allowances,
    settings: db.settings,
    sections: await getSections(),
    storage: "mongodb",
    health,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "reset-seed") {
    const result = await resetFromSeed();
    return NextResponse.json({
      ok: true,
      storage: "mongodb",
      employees: result.employees,
      periods: result.periods,
      attendance: result.attendance,
      payrollLines: result.payrollLines,
    });
  }

  if (body.action === "update-meta") {
    await updateMeta({
      company: body.company,
      allowances: body.allowances,
      settings: body.settings,
    });
    return NextResponse.json({ ok: true, storage: "mongodb" });
  }

  if (body.action === "health") {
    return NextResponse.json(await mongoHealth());
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
