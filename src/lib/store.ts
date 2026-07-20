import fs from "fs";
import path from "path";
import type { AppDatabase, AttendanceEntry, Employee, PayrollPeriod, PayrollRun } from "./types";
import { buildPayrollLine } from "./payroll";
import { createSeedDatabase } from "./seed";

/** Local: ./data — Vercel serverless: /tmp (writable) */
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "johnstich-hr")
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureDb(): AppDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw) as AppDatabase;
}

function persist(db: AppDatabase) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function getDb(): AppDatabase {
  return ensureDb();
}

export function saveDb(db: AppDatabase) {
  persist(db);
}

export function listEmployees(includeInactive = false): Employee[] {
  const db = getDb();
  return db.employees
    .filter((e) => includeInactive || e.status === "active")
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

export function getEmployee(id: string): Employee | undefined {
  return getDb().employees.find((e) => e.id === id);
}

export function upsertEmployee(employee: Employee): Employee {
  const db = getDb();
  const idx = db.employees.findIndex((e) => e.id === employee.id);
  if (idx >= 0) db.employees[idx] = employee;
  else db.employees.push(employee);
  persist(db);
  return employee;
}

export function deleteEmployee(id: string) {
  const db = getDb();
  db.employees = db.employees.map((e) =>
    e.id === id ? { ...e, status: "inactive" as const } : e
  );
  persist(db);
}

export function listPeriods(): PayrollPeriod[] {
  return getDb().periods.sort((a, b) =>
    a.year === b.year ? b.month - a.month : b.year - a.year
  );
}

export function getPeriod(id: string): PayrollPeriod | undefined {
  return getDb().periods.find((p) => p.id === id);
}

export function createPeriod(input: Omit<PayrollPeriod, "id" | "createdAt" | "status">): PayrollPeriod {
  const db = getDb();
  const id = `${input.year}-${String(input.month).padStart(2, "0")}`;
  if (db.periods.some((p) => p.id === id)) {
    throw new Error(`Period ${id} already exists`);
  }
  const period: PayrollPeriod = {
    ...input,
    id,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  db.periods.push(period);

  // Seed blank attendance for all active employees
  db.attendance[id] = db.employees
    .filter((e) => e.status === "active")
    .map((e) => ({
      employeeId: e.id,
      present12: 0,
      present8: period.monthDays,
      leave: 0,
      absent: 0,
      otHours: 0,
      advance: 0,
      canteen: 0,
    }));

  persist(db);
  return period;
}

export function getAttendance(periodId: string): AttendanceEntry[] {
  return getDb().attendance[periodId] || [];
}

export function saveAttendance(periodId: string, entries: AttendanceEntry[]) {
  const db = getDb();
  const period = db.periods.find((p) => p.id === periodId);
  if (!period) throw new Error("Period not found");
  if (period.status === "finalized") throw new Error("Period is finalized");
  db.attendance[periodId] = entries;
  persist(db);
}

export function generatePayrollRun(periodId: string): PayrollRun {
  const db = getDb();
  const period = db.periods.find((p) => p.id === periodId);
  if (!period) throw new Error("Period not found");

  const attendanceMap = new Map(
    (db.attendance[periodId] || []).map((a) => [a.employeeId, a])
  );

  const lines = db.employees
    .filter((e) => e.status === "active")
    .map((employee) => {
      const attendance = attendanceMap.get(employee.id) || {
        employeeId: employee.id,
        present12: 0,
        present8: 0,
        leave: 0,
        absent: period.monthDays,
        otHours: 0,
        advance: 0,
        canteen: 0,
      };
      return buildPayrollLine(employee, attendance, period.monthDays, db.settings.otDivisor);
    })
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  const run: PayrollRun = {
    periodId,
    lines,
    generatedAt: new Date().toISOString(),
  };
  db.runs[periodId] = run;
  persist(db);
  return run;
}

export function getPayrollRun(periodId: string): PayrollRun | undefined {
  return getDb().runs[periodId];
}

export function finalizePeriod(periodId: string) {
  const db = getDb();
  const period = db.periods.find((p) => p.id === periodId);
  if (!period) throw new Error("Period not found");
  if (!db.runs[periodId]) {
    generatePayrollRun(periodId);
  }
  const fresh = getDb();
  const p = fresh.periods.find((x) => x.id === periodId)!;
  p.status = "finalized";
  p.finalizedAt = new Date().toISOString();
  persist(fresh);
  return p;
}

export function getSections(): string[] {
  const set = new Set(getDb().employees.filter((e) => e.status === "active").map((e) => e.section));
  return Array.from(set).sort();
}

export function resetFromSeed() {
  const seed = createSeedDatabase();
  persist(seed);
  return seed;
}
