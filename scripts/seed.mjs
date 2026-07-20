import { createSeedDatabase } from "../src/lib/seed";
import { buildPayrollLine, summarizeLines } from "../src/lib/payroll";
import fs from "fs";
import path from "path";

const db = createSeedDatabase();
const period = db.periods[0];
const attendanceMap = new Map(db.attendance[period.id].map((a) => [a.employeeId, a]));

const lines = db.employees.map((emp) => {
  const att = attendanceMap.get(emp.id)!;
  return buildPayrollLine(emp, att, period.monthDays, db.settings.otDivisor);
});

const summary = summarizeLines(lines);
console.log("Employees:", lines.length);
console.log("Sections:", summary.bySection.length);
console.log("Net payable:", Math.round(summary.grand.netPayable));
console.log("OT amount:", Math.round(summary.grand.otAmount));
console.log("Expected Excel grand ~ 2039770");

const sample = lines.find((l) => l.name.includes("Harun Or Rashid"));
if (sample) {
  console.log("Sample Harun:", {
    salary8: sample.salary8.toFixed(2),
    otRate: sample.otRate.toFixed(4),
    otAmount: sample.otAmount.toFixed(2),
    net: sample.netPayable.toFixed(2),
  });
}

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "db.json"), JSON.stringify({ ...db, runs: { [period.id]: { periodId: period.id, lines, generatedAt: new Date().toISOString() } } }, null, 2));
console.log("Wrote data/db.json");
