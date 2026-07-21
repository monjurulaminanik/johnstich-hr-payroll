import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, parseSession } from "@/lib/auth";

export async function GET() {
  const jar = await cookies();
  const user = parseSession(jar.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
