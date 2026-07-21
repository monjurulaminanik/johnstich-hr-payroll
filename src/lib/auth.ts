export const DEMO_ADMIN = {
  email: "admin@gmail.com",
  password: "admin123",
  name: "Demo Administrator",
  role: "admin" as const,
};

export const SESSION_COOKIE = "jst_session";

export interface SessionUser {
  email: string;
  name: string;
  role: "admin";
}

export function isValidCredentials(email: string, password: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    e === DEMO_ADMIN.email.toLowerCase() &&
    password === DEMO_ADMIN.password
  );
}

export function parseSession(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SessionUser;
    if (data.email === DEMO_ADMIN.email && data.role === "admin") return data;
    return null;
  } catch {
    return null;
  }
}
