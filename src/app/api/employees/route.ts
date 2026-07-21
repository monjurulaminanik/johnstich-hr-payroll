import { NextRequest, NextResponse } from "next/server";
import {
  listEmployees,
  upsertEmployee,
  getEmployee,
  deleteEmployee,
} from "@/lib/store";
import type { Employee } from "@/lib/types";
import { slugId } from "@/lib/format";
import { DEFAULT_ALLOWANCES } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  const payType = searchParams.get("payType");
  const q = (searchParams.get("q") || "").toLowerCase();
  let employees = await listEmployees(true);

  if (section) employees = employees.filter((e) => e.section === section);
  if (payType === "wages" || payType === "salary") {
    employees = employees.filter((e) => (e.payType || "wages") === payType);
  }
  if (q) {
    employees = employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.cardNo.includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        e.bankAccount.includes(q)
    );
  }

  return NextResponse.json({ employees, storage: "mongodb" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = body.id || slugId("emp", `${body.cardNo}-${body.name}`);

  const payType = body.payType === "salary" ? "salary" : "wages";
  const employee: Employee = {
    id,
    cardNo: String(body.cardNo || ""),
    name: String(body.name || "").trim(),
    bankAccount: String(body.bankAccount || "").trim(),
    designation: String(body.designation || "").trim(),
    section: String(body.section || "").trim(),
    joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
    payType,
    salary12: Number(body.salary12) || 0,
    hourFactor:
      payType === "salary" || body.hourFactor === "same" || body.hourFactor === 11
        ? payType === "salary"
          ? "same"
          : body.hourFactor
        : 11.5,
    medical: Number(body.medical ?? DEFAULT_ALLOWANCES.medical),
    conveyance: Number(body.conveyance ?? DEFAULT_ALLOWANCES.conveyance),
    food: Number(body.food ?? DEFAULT_ALLOWANCES.food),
    status: body.status === "inactive" ? "inactive" : "active",
    phone: body.phone || "",
    notes: body.notes || "",
  };

  if (!employee.name || !employee.section) {
    return NextResponse.json({ error: "Name and section are required" }, { status: 400 });
  }

  await upsertEmployee(employee);
  return NextResponse.json({ employee });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const existing = await getEmployee(body.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const employee: Employee = {
    ...existing,
    ...body,
    salary12: body.salary12 !== undefined ? Number(body.salary12) : existing.salary12,
    medical: body.medical !== undefined ? Number(body.medical) : existing.medical,
    conveyance: body.conveyance !== undefined ? Number(body.conveyance) : existing.conveyance,
    food: body.food !== undefined ? Number(body.food) : existing.food,
  };
  await upsertEmployee(employee);
  return NextResponse.json({ employee });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteEmployee(id);
  return NextResponse.json({ ok: true });
}
