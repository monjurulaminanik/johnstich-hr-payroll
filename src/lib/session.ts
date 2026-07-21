import type { NextRequest } from "next/server";
import { SESSION_COOKIE, parseSession, type SessionUser } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/jwt";

export async function resolveSession(request: NextRequest): Promise<SessionUser | null> {
  const cookieSession = parseSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (cookieSession) return cookieSession;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return verifyMobileToken(auth.slice(7));
  }
  return null;
}
