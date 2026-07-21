/**
 * Seed / verify MongoDB payroll data (all Excel rows).
 * Usage: node --env-file=.env.local scripts/seed-mongo.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

// Load seed via ts compiled? Use JSON files directly + duplicate minimal check
import fs from "fs";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}

const wages = JSON.parse(
  fs.readFileSync(path.join(root, "payroll-data.json"), "utf8")
);
const salary = JSON.parse(
  fs.readFileSync(path.join(root, "salary-data.json"), "utf8")
);

const expectedWages = wages.employees.length;
const expectedSalary = salary.employees.length;
const expectedTotal = expectedWages + expectedSalary;

console.log("Excel source counts:", {
  wages: expectedWages,
  salary: expectedSalary,
  total: expectedTotal,
});

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const employees = await db.collection("employees").countDocuments();
const attendance = await db.collection("attendance").countDocuments();
const periods = await db.collection("periods").countDocuments();
const runs = await db.collection("payroll_runs").findOne({});
const wagesCount = await db.collection("employees").countDocuments({ payType: "wages" });
const salaryCount = await db.collection("employees").countDocuments({ payType: "salary" });

console.log("MongoDB counts:", {
  employees,
  wages: wagesCount,
  salary: salaryCount,
  attendance,
  periods,
  payrollLines: runs?.lines?.length ?? 0,
  dbName: db.databaseName,
});

const ok =
  employees === expectedTotal &&
  wagesCount === expectedWages &&
  salaryCount === expectedSalary &&
  attendance === expectedTotal &&
  (runs?.lines?.length ?? 0) === expectedTotal;

if (!ok) {
  console.error("FAIL — counts do not match Excel. Hit Settings → Reload Excel seed, or POST /api/settings reset-seed.");
  process.exit(1);
}

console.log("OK — every Excel row is in MongoDB.");
await client.close();
