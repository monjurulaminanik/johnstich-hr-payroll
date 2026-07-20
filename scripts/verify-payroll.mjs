import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const seedPath = fs.existsSync(path.join(root, "payroll-data.json"))
  ? path.join(root, "payroll-data.json")
  : path.join(root, "..", "payroll-data.json");

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

function salary8(m12, factor) {
  if (factor === "same") return m12;
  return (m12 * 8) / factor;
}

let net = 0;
let ot = 0;
for (const e of seed.employees) {
  const s8 = salary8(e.salary12, e.hourFactor);
  const paid = (e.present12 || 0) + (e.present8 || 0) + (e.leave || 0);
  const earned = (s8 / e.monthDays) * paid;
  const otRate = s8 / 208;
  const otAmt = otRate * (e.otHours || 0);
  const n = earned + otAmt - (e.advance || 0) - (e.canteen || 0);
  net += n;
  ot += otAmt;
}

console.log("Employees:", seed.employees.length);
console.log("Calculated net:", Math.round(net));
console.log("Excel grand net:", Math.round(seed.employees.reduce((s, e) => s + e.netPayable, 0)));
console.log("Calculated OT:", Math.round(ot));
console.log("Diff:", Math.round(net - seed.employees.reduce((s, e) => s + e.netPayable, 0)));
