import dns from "dns";
import { promises as dnsPromises } from "dns";
import { MongoClient, Db, type Collection } from "mongodb";
import type {
  AllowanceDefaults,
  AttendanceEntry,
  CompanyInfo,
  Employee,
  PayrollLine,
  PayrollPeriod,
  PayrollRun,
} from "./types";

// Windows / some ISPs break MongoDB SRV lookups — force public resolvers
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  /* ignore */
}

const RAW_URI = process.env.MONGODB_URI;

if (!RAW_URI && process.env.NODE_ENV !== "production") {
  console.warn("[mongo] MONGODB_URI is not set — add it to .env.local");
}

/** Convert mongodb+srv:// to mongodb:// using Google DNS (avoids ECONNREFUSED on SRV). */
async function resolveConnectionUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)\/?([^?]*)(\?.*)?$/);
  if (!match) return uri;

  const [, auth, host, dbName, query = ""] = match;
  const srvHost = `_mongodb._tcp.${host}`;

  const records = await dnsPromises.resolveSrv(srvHost);
  if (!records.length) throw new Error(`No SRV records for ${srvHost}`);

  let replicaSet = "";
  let authSource = "admin";
  try {
    const txt = await dnsPromises.resolveTxt(host);
    const joined = txt.flat().join("");
    const txtParams = new URLSearchParams(joined);
    replicaSet = txtParams.get("replicaSet") || "";
    authSource = txtParams.get("authSource") || "admin";
  } catch {
    /* TXT optional if query already has params */
  }

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (replicaSet && !params.has("replicaSet")) params.set("replicaSet", replicaSet);
  if (!params.has("authSource")) params.set("authSource", authSource);
  params.set("tls", "true");
  if (!params.has("retryWrites")) params.set("retryWrites", "true");
  if (!params.has("w")) params.set("w", "majority");

  const hosts = records
    .map((r) => `${r.name.replace(/\.$/, "")}:${r.port || 27017}`)
    .join(",");
  const database = dbName || "johnstich_hr";
  return `mongodb://${auth}@${hosts}/${database}?${params.toString()}`;
}

export interface AppMetaDoc {
  _id: "app";
  company: CompanyInfo;
  allowances: AllowanceDefaults;
  settings: {
    otDivisor: number;
    currency: string;
    roundTo: number;
  };
  updatedAt: string;
}

export type EmployeeDoc = Employee & { _id: string; updatedAt: string };
export type PeriodDoc = PayrollPeriod & { _id: string };
export type AttendanceDoc = AttendanceEntry & {
  _id: string;
  periodId: string;
  updatedAt: string;
};
export type PayrollRunDoc = {
  _id: string;
  periodId: string;
  lines: PayrollLine[];
  generatedAt: string;
};

declare global {
  // eslint-disable-next-line
  var __johnstichMongo: {
    client: MongoClient;
    db: Db;
    promise: Promise<Db>;
  } | undefined;
}

function attendanceKey(periodId: string, employeeId: string) {
  return `${periodId}::${employeeId}`;
}

export { attendanceKey };

export async function getDb(): Promise<Db> {
  if (!RAW_URI) {
    throw new Error(
      "MONGODB_URI is missing. Set it in .env.local (and Vercel env vars)."
    );
  }

  if (global.__johnstichMongo?.db) {
    return global.__johnstichMongo.db;
  }

  if (!global.__johnstichMongo?.promise) {
    global.__johnstichMongo = {
      client: undefined as unknown as MongoClient,
      db: undefined as unknown as Db,
      promise: (async () => {
        const uri = await resolveConnectionUri(RAW_URI);
        const client = new MongoClient(uri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 20000,
        });
        await client.connect();
        const db = client.db();
        global.__johnstichMongo!.client = client;
        global.__johnstichMongo!.db = db;
        return db;
      })(),
    };
  }

  return global.__johnstichMongo!.promise;
}

export async function collections() {
  const db = await getDb();
  return {
    meta: db.collection<AppMetaDoc>("meta"),
    employees: db.collection<EmployeeDoc>("employees"),
    periods: db.collection<PeriodDoc>("periods"),
    attendance: db.collection<AttendanceDoc>("attendance"),
    runs: db.collection<PayrollRunDoc>("payroll_runs"),
  };
}

export async function ensureIndexes() {
  const c = await collections();
  await Promise.all([
    c.employees.createIndex({ status: 1, section: 1, name: 1 }),
    c.employees.createIndex({ cardNo: 1 }),
    c.employees.createIndex({ payType: 1 }),
    c.periods.createIndex({ year: -1, month: -1 }),
    c.attendance.createIndex({ periodId: 1, employeeId: 1 }, { unique: true }),
    c.runs.createIndex({ periodId: 1 }, { unique: true }),
  ]);
}

export function toEmployee(doc: EmployeeDoc): Employee {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, updatedAt: _u, ...rest } = doc;
  return { ...rest, id: _id };
}

export function toPeriod(doc: PeriodDoc): PayrollPeriod {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

export function toAttendance(doc: AttendanceDoc): AttendanceEntry {
  return {
    employeeId: doc.employeeId,
    present12: doc.present12,
    present8: doc.present8,
    leave: doc.leave,
    absent: doc.absent,
    otHours: doc.otHours,
    advance: doc.advance,
    canteen: doc.canteen,
    earnedOverride: doc.earnedOverride ?? null,
  };
}

export function toRun(doc: PayrollRunDoc): PayrollRun {
  return {
    periodId: doc.periodId,
    lines: doc.lines,
    generatedAt: doc.generatedAt,
  };
}

export type MetaCollection = Collection<AppMetaDoc>;
