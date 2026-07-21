import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await resolveSession(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
