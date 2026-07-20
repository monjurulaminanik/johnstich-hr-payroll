# Jhonstitch HR & Payroll

HR and payroll management software for **Jhonstitch Knitting & Dyeing** (Khadun, Rupshi, Narayanganj), built from the mill's `Wages-2026.xlsm` rules.

## Features

- **Dashboard** — headcount, net payable, OT cost, attendance rate, section charts
- **Employees** — card no, bank account, designation, section, 12H salary, hour factor
- **Attendance** — Present 12H/8H, leave, absent, OT hours, advance, canteen
- **Payroll** — auto calculation matching Excel formulas, CSV export, finalize lock
- **Payslips** — printable per-employee slips
- **Reports** — section ledger, OT vs earned, cost mix
- **Settings** — reload Excel seed, create new monthly periods

## Payroll formulas (from Excel)

| Rule | Formula |
|------|---------|
| 8H salary | `12H × 8 ÷ hourFactor` (11.5 default, 11 for loaders/some roles, or same) |
| Allowances | Medical 750 + Conveyance 450 + Food 1250 |
| Basic | `(8H − allowances) × 2/3` |
| House rent | `(8H − allowances) × 1/3` |
| OT rate | `8H ÷ 208` |
| Paid days | `Present12 + Present8 + Leave` |
| Earned salary | `(8H ÷ monthDays) × paidDays` |
| Net payable | `Earned + OT − Advance − Canteen` |

## Run locally

```bash
cd hr-payroll
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

June 2026 wages (145 employees, 10 sections) load automatically from `payroll-data.json` (exported from `Wages-2026.xlsm`).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run seed` — regenerate `data/db.json` from Excel export

## Data

Runtime database: `data/db.json` (created on first API request).
