import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./auth";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "jhonstitch-hr-mobile-dev-secret-change-in-prod"
);

const JWT_ISSUER = "jhonstitch-hr";
const JWT_AUDIENCE = "mobile";
const JWT_EXPIRY = "7d";

export async function signMobileToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyMobileToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const email = String(payload.email || "");
    const name = String(payload.name || "");
    const role = payload.role as SessionUser["role"];
    if (role !== "admin" || !email) return null;
    return { email, name, role };
  } catch {
    return null;
  }
}
