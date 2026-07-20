import type {
  AllowanceDefaults,
  AttendanceEntry,
  Employee,
  HourFactor,
  PayType,
  PayrollLine,
} from "./types";

export const DEFAULT_ALLOWANCES: AllowanceDefaults = {
  medical: 750,
  conveyance: 450,
  food: 1250,
};

export const OT_DIVISOR = 208;

export function normalizeSection(raw: string): string {
  return raw
    .replace(/^Section:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/Oparator/gi, "Operator")
    .replace(/Quallity/gi, "Quality");
}

export function computeSalary8(
  salary12: number,
  hourFactor: HourFactor,
  payType: PayType = "wages"
): number {
  // Salary staff use full monthly amount (no 12H→8H conversion)
  if (payType === "salary" || hourFactor === "same" || salary12 === 0) return salary12;
  return (salary12 * 8) / hourFactor;
}

export function computeBreakdown(
  basePay: number,
  medical: number,
  conveyance: number,
  food: number
) {
  const fixed = medical + conveyance + food;
  const remaining = Math.max(0, basePay - fixed);
  const basic = (remaining * 2) / 3;
  const houseRent = remaining / 3;
  return { basic, houseRent, medical, conveyance, food };
}

export function computeOtRate(
  salary8: number,
  otDivisor = OT_DIVISOR,
  payType: PayType = "wages"
): number {
  if (payType === "salary") return 0;
  return salary8 / otDivisor;
}

export function computePaidDays(
  entry: Pick<AttendanceEntry, "present12" | "present8" | "leave">,
  payType: PayType = "wages"
): number {
  if (payType === "salary") {
    return (entry.present12 || 0) + (entry.leave || 0);
  }
  return (entry.present12 || 0) + (entry.present8 || 0) + (entry.leave || 0);
}

export function computeTotalSalary(basePay: number, monthDays: number, paidDays: number): number {
  if (!monthDays) return 0;
  return (basePay / monthDays) * paidDays;
}

export function roundMoney(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function buildPayrollLine(
  employee: Employee,
  attendance: AttendanceEntry,
  monthDays: number,
  otDivisor = OT_DIVISOR
): PayrollLine {
  const payType = employee.payType || "wages";
  const basePay = computeSalary8(employee.salary12, employee.hourFactor, payType);
  const breakdown = computeBreakdown(
    basePay,
    employee.medical,
    employee.conveyance,
    employee.food
  );
  const paidDays = computePaidDays(attendance, payType);
  let totalSalary = computeTotalSalary(basePay, monthDays, paidDays);
  if (attendance.earnedOverride != null && attendance.earnedOverride > 0) {
    totalSalary = attendance.earnedOverride;
  }

  const otRate = computeOtRate(basePay, otDivisor, payType);
  const otHours = payType === "salary" ? 0 : attendance.otHours || 0;
  const otAmount = otRate * otHours;
  const advance = attendance.advance || 0;
  const canteen = attendance.canteen || 0;
  const absent = attendance.absent ?? Math.max(0, monthDays - paidDays);
  const netPayable = totalSalary + otAmount - advance - canteen;

  return {
    employeeId: employee.id,
    cardNo: employee.cardNo,
    name: employee.name,
    bankAccount: employee.bankAccount,
    designation: employee.designation,
    section: employee.section,
    payType,
    salary12: employee.salary12,
    salary8: basePay,
    basic: breakdown.basic,
    houseRent: breakdown.houseRent,
    medical: breakdown.medical,
    conveyance: breakdown.conveyance,
    food: breakdown.food,
    monthDays,
    present12: attendance.present12 || 0,
    present8: attendance.present8 || 0,
    leave: attendance.leave || 0,
    absent,
    paidDays,
    totalSalary,
    otRate,
    otHours,
    otAmount,
    advance,
    canteen,
    netPayable,
  };
}

export function summarizeLines(lines: PayrollLine[]) {
  const bySection = new Map<
    string,
    {
      count: number;
      salary12: number;
      salary8: number;
      totalSalary: number;
      otAmount: number;
      advance: number;
      canteen: number;
      netPayable: number;
    }
  >();

  const byPayType = {
    wages: { count: 0, netPayable: 0, totalSalary: 0, otAmount: 0 },
    salary: { count: 0, netPayable: 0, totalSalary: 0, otAmount: 0 },
  };

  for (const line of lines) {
    const cur = bySection.get(line.section) || {
      count: 0,
      salary12: 0,
      salary8: 0,
      totalSalary: 0,
      otAmount: 0,
      advance: 0,
      canteen: 0,
      netPayable: 0,
    };
    cur.count += 1;
    cur.salary12 += line.salary12;
    cur.salary8 += line.salary8;
    cur.totalSalary += line.totalSalary;
    cur.otAmount += line.otAmount;
    cur.advance += line.advance;
    cur.canteen += line.canteen;
    cur.netPayable += line.netPayable;
    bySection.set(line.section, cur);

    const pt = line.payType || "wages";
    byPayType[pt].count += 1;
    byPayType[pt].netPayable += line.netPayable;
    byPayType[pt].totalSalary += line.totalSalary;
    byPayType[pt].otAmount += line.otAmount;
  }

  const grand = {
    count: lines.length,
    salary12: lines.reduce((s, l) => s + l.salary12, 0),
    salary8: lines.reduce((s, l) => s + l.salary8, 0),
    totalSalary: lines.reduce((s, l) => s + l.totalSalary, 0),
    otAmount: lines.reduce((s, l) => s + l.otAmount, 0),
    advance: lines.reduce((s, l) => s + l.advance, 0),
    canteen: lines.reduce((s, l) => s + l.canteen, 0),
    netPayable: lines.reduce((s, l) => s + l.netPayable, 0),
  };

  return {
    bySection: Array.from(bySection.entries()).map(([section, stats]) => ({
      section,
      ...stats,
    })),
    byPayType,
    grand,
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function periodLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}
