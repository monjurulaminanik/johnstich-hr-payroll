import fs from "fs";
import path from "path";
import type { AppDatabase, AttendanceEntry, Employee, HourFactor, PayType } from "./types";
import { DEFAULT_ALLOWANCES, normalizeSection, periodLabel } from "./payroll";
import { excelSerialToISO, slugId } from "./format";

interface SeedEmployee {
  section: string;
  sl: number;
  name: string;
  bank: string;
  designation: string;
  joining: number | string;
  cardNo: string;
  salary12: number;
  present12: number;
  present8?: number;
  leave: number;
  absent: number;
  otHours?: number;
  advance: number;
  canteen: number;
  hourFactor: number | "same";
  medical: number;
  conveyance: number;
  food: number;
  payType?: PayType;
  earnedOverride?: number | null;
}

interface SeedFile {
  company: {
    name: string;
    address: string;
    month: string;
    monthDays: number;
  };
  employees: SeedEmployee[];
}

function resolveHourFactor(raw: number | "same", payType: PayType): HourFactor {
  if (payType === "salary") return "same";
  if (raw === "same") return "same";
  if (Math.abs(Number(raw) - 11) < 0.05) return 11;
  return 11.5;
}

function joiningToISO(joining: number | string): string {
  if (typeof joining === "number") return excelSerialToISO(joining);
  const cleaned = String(joining).trim().replace(/\./g, "/");
  // Handle DD.MM.YY / DD/MM/YY style from salary sheet
  const m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1];
    const mo = m[2];
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    // Prefer DMY when day > 12, else try as written from Excel (often MDY for US serials already converted)
    const day = Number(d);
    const month = Number(mo);
    if (day > 12) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(joining);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "2026-04-16";
}

function findSeedFile(name: string): string | null {
  const candidates = [
    path.join(process.cwd(), name),
    path.join(process.cwd(), "..", name),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function ingestSeedFile(
  filePath: string,
  defaultPayType: PayType,
  usedIds: Set<string>
): { employees: Employee[]; attendance: AttendanceEntry[]; company?: SeedFile["company"] } {
  const seed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SeedFile;
  const employees: Employee[] = [];
  const attendance: AttendanceEntry[] = [];

  for (const row of seed.employees) {
    const payType = row.payType || defaultPayType;
    const section = normalizeSection(row.section);
    let id = slugId(payType === "salary" ? "sal" : "emp", `${row.cardNo}-${row.name}`);
    if (usedIds.has(id)) id = `${id}-${row.sl}`;
    usedIds.add(id);

    employees.push({
      id,
      cardNo: String(row.cardNo || ""),
      name: row.name.trim(),
      bankAccount: String(row.bank || "").trim(),
      designation: String(row.designation || "").trim(),
      section,
      joiningDate: joiningToISO(row.joining),
      payType,
      salary12: Number(row.salary12) || 0,
      hourFactor: resolveHourFactor(row.hourFactor, payType),
      medical: Number(row.medical) || DEFAULT_ALLOWANCES.medical,
      conveyance: Number(row.conveyance) || DEFAULT_ALLOWANCES.conveyance,
      food: Number(row.food) || DEFAULT_ALLOWANCES.food,
      status: "active",
    });

    attendance.push({
      employeeId: id,
      present12: Number(row.present12) || 0,
      present8: Number(row.present8) || 0,
      leave: Number(row.leave) || 0,
      absent: Number(row.absent) || 0,
      otHours: payType === "salary" ? 0 : Number(row.otHours) || 0,
      advance: Number(row.advance) || 0,
      canteen: Number(row.canteen) || 0,
      earnedOverride: row.earnedOverride ?? null,
    });
  }

  return { employees, attendance, company: seed.company };
}

export function createSeedDatabase(): AppDatabase {
  const wagesPath = findSeedFile("payroll-data.json");
  const salaryPath = findSeedFile("salary-data.json");

  if (!wagesPath && !salaryPath) {
    return emptyDatabase();
  }

  const periodId = "2026-06";
  const usedIds = new Set<string>();
  let company = emptyDatabase().company;
  let monthDays = 30;
  const employees: Employee[] = [];
  const attendance: AttendanceEntry[] = [];

  if (wagesPath) {
    const wages = ingestSeedFile(wagesPath, "wages", usedIds);
    employees.push(...wages.employees);
    attendance.push(...wages.attendance);
    if (wages.company) {
      company = {
        name: wages.company.name.trim(),
        address: wages.company.address.trim(),
        brandShort: "Jhonstitch",
      };
      monthDays = wages.company.monthDays || 30;
    }
  }

  if (salaryPath) {
    const salary = ingestSeedFile(salaryPath, "salary", usedIds);
    employees.push(...salary.employees);
    attendance.push(...salary.attendance);
    if (!wagesPath && salary.company) {
      company = {
        name: salary.company.name.trim(),
        address: salary.company.address.trim(),
        brandShort: "Jhonstitch",
      };
      monthDays = salary.company.monthDays || 30;
    }
  }

  // Tag existing wages seed rows that lacked payType
  for (const e of employees) {
    if (!e.payType) e.payType = "wages";
  }

  return {
    company,
    allowances: { ...DEFAULT_ALLOWANCES },
    employees,
    periods: [
      {
        id: periodId,
        label: periodLabel(2026, 6),
        year: 2026,
        month: 6,
        monthDays,
        status: "draft",
        createdAt: new Date().toISOString(),
      },
    ],
    attendance: {
      [periodId]: attendance,
    },
    runs: {},
    settings: {
      otDivisor: 208,
      currency: "BDT",
      roundTo: 2,
    },
  };
}

function emptyDatabase(): AppDatabase {
  return {
    company: {
      name: "JHONSTITCH KNITTING & DYEING",
      address: "Khadun, Rupshi, Narayangonj.",
      brandShort: "Jhonstitch",
    },
    allowances: { ...DEFAULT_ALLOWANCES },
    employees: [],
    periods: [],
    attendance: {},
    runs: {},
    settings: {
      otDivisor: 208,
      currency: "BDT",
      roundTo: 2,
    },
  };
}
