import { NextResponse } from "next/server";
import { getDb, getSections, resetFromSeed } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    company: db.company,
    allowances: db.allowances,
    settings: db.settings,
    sections: getSections(),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.action === "reset-seed") {
    const db = resetFromSeed();
    return NextResponse.json({
      ok: true,
      employees: db.employees.length,
      periods: db.periods.length,
    });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
