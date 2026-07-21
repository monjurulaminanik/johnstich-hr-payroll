import type {
  AppDatabase,
  AttendanceEntry,
  Employee,
  PayrollPeriod,
  PayrollRun,
} from "./types";
import { buildPayrollLine } from "./payroll";
import { createSeedDatabase } from "./seed";
import {
  attendanceKey,
  collections,
  ensureIndexes,
  toAttendance,
  toEmployee,
  toPeriod,
  toRun,
  type AppMetaDoc,
  type AttendanceDoc,
  type EmployeeDoc,
  type PeriodDoc,
  type PayrollRunDoc,
} from "./mongo";

let bootstrapped = false;

async function ensureReady() {
  const c = await collections();
  if (!bootstrapped) {
    await ensureIndexes();
    bootstrapped = true;
  }

  const count = await c.employees.countDocuments();
  if (count === 0) {
    const seed = createSeedDatabase();
    await writeFullDatabase(seed);
    for (const p of seed.periods) {
      await generatePayrollRun(p.id);
    }
  }
}

async function writeFullDatabase(seed: AppDatabase) {
  const c = await collections();
  const now = new Date().toISOString();

  await Promise.all([
    c.meta.deleteMany({}),
    c.employees.deleteMany({}),
    c.periods.deleteMany({}),
    c.attendance.deleteMany({}),
    c.runs.deleteMany({}),
  ]);

  const meta: AppMetaDoc = {
    _id: "app",
    company: seed.company,
    allowances: seed.allowances,
    settings: seed.settings,
    updatedAt: now,
  };
  await c.meta.insertOne(meta);

  if (seed.employees.length) {
    const empDocs: EmployeeDoc[] = seed.employees.map((e) => ({
      ...e,
      _id: e.id,
      updatedAt: now,
    }));
    // Insert in chunks to avoid payload limits
    const chunk = 100;
    for (let i = 0; i < empDocs.length; i += chunk) {
      await c.employees.insertMany(empDocs.slice(i, i + chunk), { ordered: true });
    }
  }

  if (seed.periods.length) {
    const periodDocs: PeriodDoc[] = seed.periods.map((p) => ({
      ...p,
      _id: p.id,
    }));
    await c.periods.insertMany(periodDocs);
  }

  const attendanceDocs: AttendanceDoc[] = [];
  for (const [periodId, entries] of Object.entries(seed.attendance)) {
    for (const a of entries) {
      attendanceDocs.push({
        _id: attendanceKey(periodId, a.employeeId),
        periodId,
        employeeId: a.employeeId,
        present12: a.present12,
        present8: a.present8,
        leave: a.leave,
        absent: a.absent,
        otHours: a.otHours,
        advance: a.advance,
        canteen: a.canteen,
        earnedOverride: a.earnedOverride ?? null,
        updatedAt: now,
      });
    }
  }
  if (attendanceDocs.length) {
    const chunk = 100;
    for (let i = 0; i < attendanceDocs.length; i += chunk) {
      await c.attendance.insertMany(attendanceDocs.slice(i, i + chunk), {
        ordered: true,
      });
    }
  }

  for (const [periodId, run] of Object.entries(seed.runs)) {
    const runDoc: PayrollRunDoc = {
      _id: periodId,
      periodId,
      lines: run.lines,
      generatedAt: run.generatedAt,
    };
    await c.runs.insertOne(runDoc);
  }
}

async function getMeta(): Promise<AppMetaDoc> {
  await ensureReady();
  const c = await collections();
  let meta = await c.meta.findOne({ _id: "app" });
  if (!meta) {
    const seed = createSeedDatabase();
    await writeFullDatabase(seed);
    for (const p of seed.periods) {
      await generatePayrollRun(p.id);
    }
    meta = await c.meta.findOne({ _id: "app" });
  }
  if (!meta) throw new Error("Failed to load app meta from MongoDB");
  return meta;
}

export async function getDbSnapshot(): Promise<AppDatabase> {
  await ensureReady();
  const c = await collections();
  const meta = await getMeta();
  const [employees, periods, attendanceDocs, runDocs] = await Promise.all([
    c.employees.find({}).toArray(),
    c.periods.find({}).toArray(),
    c.attendance.find({}).toArray(),
    c.runs.find({}).toArray(),
  ]);

  const attendance: AppDatabase["attendance"] = {};
  for (const doc of attendanceDocs) {
    if (!attendance[doc.periodId]) attendance[doc.periodId] = [];
    attendance[doc.periodId].push(toAttendance(doc));
  }

  const runs: AppDatabase["runs"] = {};
  for (const doc of runDocs) {
    runs[doc.periodId] = toRun(doc);
  }

  return {
    company: meta.company,
    allowances: meta.allowances,
    settings: meta.settings,
    employees: employees.map(toEmployee),
    periods: periods.map(toPeriod),
    attendance,
    runs,
  };
}

export async function listEmployees(includeInactive = false): Promise<Employee[]> {
  await ensureReady();
  const c = await collections();
  const filter = includeInactive ? {} : { status: "active" as const };
  const docs = await c.employees.find(filter).toArray();
  return docs
    .map(toEmployee)
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  await ensureReady();
  const c = await collections();
  const doc = await c.employees.findOne({ _id: id });
  return doc ? toEmployee(doc) : undefined;
}

export async function upsertEmployee(employee: Employee): Promise<Employee> {
  await ensureReady();
  const c = await collections();
  const now = new Date().toISOString();
  const doc: EmployeeDoc = { ...employee, _id: employee.id, updatedAt: now };
  await c.employees.replaceOne({ _id: employee.id }, doc, { upsert: true });
  return employee;
}

export async function deleteEmployee(id: string) {
  await ensureReady();
  const c = await collections();
  await c.employees.updateOne(
    { _id: id },
    { $set: { status: "inactive", updatedAt: new Date().toISOString() } }
  );
}

export async function listPeriods(): Promise<PayrollPeriod[]> {
  await ensureReady();
  const c = await collections();
  const docs = await c.periods.find({}).toArray();
  return docs
    .map(toPeriod)
    .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year));
}

export async function getPeriod(id: string): Promise<PayrollPeriod | undefined> {
  await ensureReady();
  const c = await collections();
  const doc = await c.periods.findOne({ _id: id });
  return doc ? toPeriod(doc) : undefined;
}

export async function createPeriod(
  input: Omit<PayrollPeriod, "id" | "createdAt" | "status">
): Promise<PayrollPeriod> {
  await ensureReady();
  const c = await collections();
  const id = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const existing = await c.periods.findOne({ _id: id });
  if (existing) throw new Error(`Period ${id} already exists`);

  const period: PayrollPeriod = {
    ...input,
    id,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  await c.periods.insertOne({ ...period, _id: id });

  const active = await c.employees.find({ status: "active" }).toArray();
  const now = new Date().toISOString();
  if (active.length) {
    const docs: AttendanceDoc[] = active.map((e) => ({
      _id: attendanceKey(id, e._id),
      periodId: id,
      employeeId: e._id,
      present12: 0,
      present8: period.monthDays,
      leave: 0,
      absent: 0,
      otHours: 0,
      advance: 0,
      canteen: 0,
      earnedOverride: null,
      updatedAt: now,
    }));
    const chunk = 100;
    for (let i = 0; i < docs.length; i += chunk) {
      await c.attendance.insertMany(docs.slice(i, i + chunk));
    }
  }

  return period;
}

export async function getAttendance(periodId: string): Promise<AttendanceEntry[]> {
  await ensureReady();
  const c = await collections();
  const docs = await c.attendance.find({ periodId }).toArray();
  return docs.map(toAttendance);
}

export async function saveAttendance(periodId: string, entries: AttendanceEntry[]) {
  await ensureReady();
  const c = await collections();
  const period = await c.periods.findOne({ _id: periodId });
  if (!period) throw new Error("Period not found");
  if (period.status === "finalized") throw new Error("Period is finalized");

  const now = new Date().toISOString();
  const ops = entries.map((a) => ({
    replaceOne: {
      filter: { _id: attendanceKey(periodId, a.employeeId) },
      replacement: {
        _id: attendanceKey(periodId, a.employeeId),
        periodId,
        employeeId: a.employeeId,
        present12: a.present12,
        present8: a.present8,
        leave: a.leave,
        absent: a.absent,
        otHours: a.otHours,
        advance: a.advance,
        canteen: a.canteen,
        earnedOverride: a.earnedOverride ?? null,
        updatedAt: now,
      } satisfies AttendanceDoc,
      upsert: true,
    },
  }));

  // bulkWrite in chunks
  const chunk = 50;
  for (let i = 0; i < ops.length; i += chunk) {
    await c.attendance.bulkWrite(ops.slice(i, i + chunk), { ordered: false });
  }
}

export async function generatePayrollRun(periodId: string): Promise<PayrollRun> {
  await ensureReady();
  const c = await collections();
  const periodDoc = await c.periods.findOne({ _id: periodId });
  if (!periodDoc) throw new Error("Period not found");
  const period = toPeriod(periodDoc);
  const meta = await getMeta();

  const [employees, attendanceDocs] = await Promise.all([
    c.employees.find({ status: "active" }).toArray(),
    c.attendance.find({ periodId }).toArray(),
  ]);

  const attendanceMap = new Map(
    attendanceDocs.map((a) => [a.employeeId, toAttendance(a)])
  );

  const lines = employees
    .map((doc) => {
      const employee = toEmployee(doc);
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
      return buildPayrollLine(
        employee,
        attendance,
        period.monthDays,
        meta.settings.otDivisor
      );
    })
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  const run: PayrollRun = {
    periodId,
    lines,
    generatedAt: new Date().toISOString(),
  };

  await c.runs.replaceOne(
    { _id: periodId },
    {
      periodId,
      lines: run.lines,
      generatedAt: run.generatedAt,
    } as PayrollRunDoc,
    { upsert: true }
  );

  return run;
}

export async function getPayrollRun(periodId: string): Promise<PayrollRun | undefined> {
  await ensureReady();
  const c = await collections();
  const doc = await c.runs.findOne({ _id: periodId });
  return doc ? toRun(doc) : undefined;
}

export async function finalizePeriod(periodId: string) {
  await ensureReady();
  const c = await collections();
  const period = await c.periods.findOne({ _id: periodId });
  if (!period) throw new Error("Period not found");

  const run = await c.runs.findOne({ _id: periodId });
  if (!run) await generatePayrollRun(periodId);

  const finalizedAt = new Date().toISOString();
  await c.periods.updateOne(
    { _id: periodId },
    { $set: { status: "finalized", finalizedAt } }
  );
  return { ...toPeriod(period), status: "finalized" as const, finalizedAt };
}

export async function getSections(): Promise<string[]> {
  await ensureReady();
  const c = await collections();
  const sections = await c.employees.distinct("section", { status: "active" });
  return (sections as string[]).sort();
}

export async function updateMeta(patch: {
  company?: AppMetaDoc["company"];
  allowances?: AppMetaDoc["allowances"];
  settings?: AppMetaDoc["settings"];
}) {
  await ensureReady();
  const c = await collections();
  const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.company) $set.company = patch.company;
  if (patch.allowances) $set.allowances = patch.allowances;
  if (patch.settings) $set.settings = patch.settings;
  await c.meta.updateOne({ _id: "app" }, { $set }, { upsert: true });
}

export async function resetFromSeed(): Promise<{
  employees: number;
  periods: number;
  attendance: number;
  payrollLines: number;
}> {
  bootstrapped = false;
  const seed = createSeedDatabase();
  await writeFullDatabase(seed);

  // Ensure payroll run exists with every line
  for (const p of seed.periods) {
    await generatePayrollRun(p.id);
  }

  const c = await collections();
  const [employees, periods, attendance, run] = await Promise.all([
    c.employees.countDocuments(),
    c.periods.countDocuments(),
    c.attendance.countDocuments(),
    c.runs.findOne({ _id: seed.periods[0]?.id }),
  ]);

  if (employees !== seed.employees.length) {
    throw new Error(
      `Seed mismatch: expected ${seed.employees.length} employees, got ${employees}`
    );
  }
  if (attendance !== Object.values(seed.attendance).flat().length) {
    throw new Error(
      `Seed mismatch: attendance count ${attendance} != seed ${Object.values(seed.attendance).flat().length}`
    );
  }

  return {
    employees,
    periods,
    attendance,
    payrollLines: run?.lines.length || 0,
  };
}

export async function mongoHealth() {
  await ensureReady();
  const c = await collections();
  const [employees, periods, attendance, runs, meta] = await Promise.all([
    c.employees.countDocuments(),
    c.periods.countDocuments(),
    c.attendance.countDocuments(),
    c.runs.countDocuments(),
    c.meta.findOne({ _id: "app" }),
  ]);
  const wages = await c.employees.countDocuments({ payType: "wages" });
  const salary = await c.employees.countDocuments({ payType: "salary" });
  return {
    ok: true,
    database: "mongodb",
    employees,
    wages,
    salary,
    periods,
    attendance,
    runs,
    company: meta?.company?.name || null,
  };
}
