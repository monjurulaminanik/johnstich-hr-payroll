export type HourFactor = 11.5 | 11 | "same";
export type PayType = "wages" | "salary";

export interface CompanyInfo {
  name: string;
  address: string;
  brandShort: string;
}

export interface AllowanceDefaults {
  medical: number;
  conveyance: number;
  food: number;
}

export interface Employee {
  id: string;
  cardNo: string;
  name: string;
  bankAccount: string;
  designation: string;
  section: string;
  joiningDate: string; // ISO date
  payType: PayType;
  salary12: number;
  hourFactor: HourFactor;
  medical: number;
  conveyance: number;
  food: number;
  status: "active" | "inactive";
  phone?: string;
  notes?: string;
}

export interface AttendanceEntry {
  employeeId: string;
  present12: number;
  present8: number;
  leave: number;
  absent: number;
  otHours: number;
  advance: number;
  canteen: number;
  /** Rare Excel overrides (e.g. partial joining advance pay) */
  earnedOverride?: number | null;
}

export interface PayrollPeriod {
  id: string;
  label: string;
  year: number;
  month: number; // 1-12
  monthDays: number;
  status: "draft" | "finalized";
  createdAt: string;
  finalizedAt?: string;
}

export interface PayrollLine {
  employeeId: string;
  cardNo: string;
  name: string;
  bankAccount: string;
  designation: string;
  section: string;
  payType: PayType;
  salary12: number;
  salary8: number;
  basic: number;
  houseRent: number;
  medical: number;
  conveyance: number;
  food: number;
  monthDays: number;
  present12: number;
  present8: number;
  leave: number;
  absent: number;
  paidDays: number;
  totalSalary: number;
  otRate: number;
  otHours: number;
  otAmount: number;
  advance: number;
  canteen: number;
  netPayable: number;
}

export interface PayrollRun {
  periodId: string;
  lines: PayrollLine[];
  generatedAt: string;
}

export interface AppDatabase {
  company: CompanyInfo;
  allowances: AllowanceDefaults;
  employees: Employee[];
  periods: PayrollPeriod[];
  attendance: Record<string, AttendanceEntry[]>; // keyed by periodId
  runs: Record<string, PayrollRun>;
  settings: {
    otDivisor: number;
    currency: string;
    roundTo: number;
  };
}
