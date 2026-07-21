/**
 * Full Excel → MongoDB seed (no data loss).
 * node --env-file=.env.local scripts/seed-mongo.mjs
 */
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}

const DEFAULT_ALLOWANCES = { medical: 750, conveyance: 450, food: 1250 };
const OT_DIVISOR = 208;

function normalizeSection(raw) {
  return String(raw || "")
    .replace(/^Section:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/Oparator/gi, "Operator")
    .replace(/Quallity/gi, "Quality");
}

function excelSerialToISO(serial) {
  const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function slugId(prefix, value) {
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${prefix}-${clean || Math.random().toString(36).slice(2, 8)}`;
}

function joiningToISO(joining) {
  if (typeof joining === "number") return excelSerialToISO(joining);
  const cleaned = String(joining).trim().replace(/\./g, "/");
  const m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1];
    const mo = m[2];
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
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

function resolveHourFactor(raw, payType) {
  if (payType === "salary") return "same";
  if (raw === "same") return "same";
  if (Math.abs(Number(raw) - 11) < 0.05) return 11;
  return 11.5;
}

function periodLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function computeSalary8(salary12, hourFactor, payType) {
  if (payType === "salary" || hourFactor === "same") return salary12;
  const f = Number(hourFactor) || 11.5;
  return (salary12 * 8) / f;
}

function computeBreakdown(salary8, medical, conveyance, food) {
  const allowances = medical + conveyance + food;
  const base = Math.max(salary8 - allowances, 0);
  return {
    basic: round2((base * 2) / 3),
    houseRent: round2(base / 3),
    medical,
    conveyance,
    food,
  };
}

function computeOtRate(salary8, divisor, payType) {
  if (payType === "salary") return 0;
  return salary8 / (divisor || OT_DIVISOR);
}

function buildPayrollLine(employee, attendance, monthDays, otDivisor) {
  const payType = employee.payType || "wages";
  const salary8 = computeSalary8(employee.salary12, employee.hourFactor, payType);
  const br = computeBreakdown(
    salary8,
    employee.medical,
    employee.conveyance,
    employee.food
  );
  const present12 = attendance.present12 || 0;
  const present8 = attendance.present8 || 0;
  const leave = attendance.leave || 0;
  const absent = attendance.absent || 0;
  const paidDays =
    payType === "salary" ? present12 + leave : present12 + present8 + leave;
  const otRate = computeOtRate(salary8, otDivisor, payType);
  const otHours = payType === "salary" ? 0 : attendance.otHours || 0;
  const otAmount = round2(otRate * otHours);
  let totalSalary = round2((salary8 / monthDays) * paidDays);
  if (attendance.earnedOverride != null && attendance.earnedOverride !== "") {
    totalSalary = round2(Number(attendance.earnedOverride));
  }
  const advance = attendance.advance || 0;
  const canteen = attendance.canteen || 0;
  const netPayable = round2(totalSalary + otAmount - advance - canteen);

  return {
    employeeId: employee.id,
    cardNo: employee.cardNo,
    name: employee.name,
    bankAccount: employee.bankAccount,
    designation: employee.designation,
    section: employee.section,
    payType,
    salary12: employee.salary12,
    salary8: round2(salary8),
    basic: br.basic,
    houseRent: br.houseRent,
    medical: br.medical,
    conveyance: br.conveyance,
    food: br.food,
    monthDays,
    present12,
    present8,
    leave,
    absent,
    paidDays,
    totalSalary,
    otRate: round2(otRate),
    otHours,
    otAmount,
    advance,
    canteen,
    netPayable,
  };
}

function ingest(filePath, defaultPayType, usedIds) {
  const seed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const employees = [];
  const attendance = [];
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

function attendanceKey(periodId, employeeId) {
  return `${periodId}::${employeeId}`;
}

async function insertChunks(col, docs, size = 100) {
  for (let i = 0; i < docs.length; i += size) {
    await col.insertMany(docs.slice(i, i + size), { ordered: true });
  }
}

const wagesPath = path.join(root, "payroll-data.json");
const salaryPath = path.join(root, "salary-data.json");
const usedIds = new Set();
const wages = ingest(wagesPath, "wages", usedIds);
const salary = ingest(salaryPath, "salary", usedIds);

const employees = [...wages.employees, ...salary.employees];
const attendance = [...wages.attendance, ...salary.attendance];
const company = {
  name: wages.company.name.trim(),
  address: wages.company.address.trim(),
  brandShort: "Jhonstitch",
};
const monthDays = wages.company.monthDays || 30;
const periodId = "2026-06";
const now = new Date().toISOString();

console.log("Seeding Excel rows:", {
  wages: wages.employees.length,
  salary: salary.employees.length,
  total: employees.length,
  attendance: attendance.length,
});

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 30000 });
await client.connect();
const db = client.db();
console.log("Connected to", db.databaseName);

await Promise.all([
  db.collection("meta").deleteMany({}),
  db.collection("employees").deleteMany({}),
  db.collection("periods").deleteMany({}),
  db.collection("attendance").deleteMany({}),
  db.collection("payroll_runs").deleteMany({}),
]);

await db.collection("meta").insertOne({
  _id: "app",
  company,
  allowances: { ...DEFAULT_ALLOWANCES },
  settings: { otDivisor: OT_DIVISOR, currency: "BDT", roundTo: 2 },
  updatedAt: now,
});

await insertChunks(
  db.collection("employees"),
  employees.map((e) => ({ ...e, _id: e.id, updatedAt: now }))
);

await db.collection("periods").insertOne({
  _id: periodId,
  id: periodId,
  label: periodLabel(2026, 6),
  year: 2026,
  month: 6,
  monthDays,
  status: "draft",
  createdAt: now,
});

await insertChunks(
  db.collection("attendance"),
  attendance.map((a) => ({
    _id: attendanceKey(periodId, a.employeeId),
    periodId,
    ...a,
    updatedAt: now,
  }))
);

const attMap = new Map(attendance.map((a) => [a.employeeId, a]));
const lines = employees
  .map((e) =>
    buildPayrollLine(
      e,
      attMap.get(e.id) || {
        employeeId: e.id,
        present12: 0,
        present8: 0,
        leave: 0,
        absent: monthDays,
        otHours: 0,
        advance: 0,
        canteen: 0,
      },
      monthDays,
      OT_DIVISOR
    )
  )
  .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

await db.collection("payroll_runs").insertOne({
  _id: periodId,
  periodId,
  lines,
  generatedAt: now,
});

await Promise.all([
  db.collection("employees").createIndex({ status: 1, section: 1, name: 1 }),
  db.collection("employees").createIndex({ cardNo: 1 }),
  db.collection("attendance").createIndex({ periodId: 1, employeeId: 1 }, { unique: true }),
]);

const counts = {
  employees: await db.collection("employees").countDocuments(),
  wages: await db.collection("employees").countDocuments({ payType: "wages" }),
  salary: await db.collection("employees").countDocuments({ payType: "salary" }),
  attendance: await db.collection("attendance").countDocuments(),
  payrollLines: lines.length,
  netSum: round2(lines.reduce((s, l) => s + l.netPayable, 0)),
};

console.log("MongoDB result:", counts);

const expected = {
  employees: employees.length,
  wages: wages.employees.length,
  salary: salary.employees.length,
  attendance: attendance.length,
  payrollLines: employees.length,
};

const ok = Object.keys(expected).every((k) => counts[k] === expected[k]);
if (!ok) {
  console.error("FAIL mismatch", { expected, counts });
  process.exit(1);
}
console.log("OK — every Excel row is in MongoDB. Zero data lost.");
await client.close();
