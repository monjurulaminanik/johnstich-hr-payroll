"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Search, Trash2, X } from "lucide-react";
import type { Employee, HourFactor, PayType } from "@/lib/types";
import { formatBDTCurrency, formatDate } from "@/lib/format";
import { computeSalary8, computeBreakdown, computeOtRate } from "@/lib/payroll";
import { downloadExcel, round2 } from "@/lib/excel";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";

const EMPTY: Partial<Employee> = {
  name: "",
  cardNo: "",
  bankAccount: "",
  designation: "",
  section: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  payType: "wages",
  salary12: 14500,
  hourFactor: 11.5,
  medical: 750,
  conveyance: 450,
  food: 1250,
  status: "active",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [payType, setPayType] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (section) params.set("section", section);
    if (payType) params.set("payType", payType);
    const [empRes, setRes] = await Promise.all([
      fetch(`/api/employees?${params}`),
      fetch("/api/settings"),
    ]);
    const empData = await empRes.json();
    const setData = await setRes.json();
    setEmployees(empData.employees || []);
    setSections(setData.sections || []);
    setLoading(false);
  }, [q, section, payType]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const preview = useMemo(() => {
    const salary12 = Number(form.salary12) || 0;
    const pt = (form.payType || "wages") as PayType;
    const hf = (form.hourFactor || 11.5) as HourFactor;
    const salary8 = computeSalary8(salary12, hf, pt);
    const breakdown = computeBreakdown(
      salary8,
      Number(form.medical) || 0,
      Number(form.conveyance) || 0,
      Number(form.food) || 0
    );
    return { salary8, ...breakdown, otRate: computeOtRate(salary8, 208, pt) };
  }, [form]);

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/employees", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setModalOpen(false);
    setForm(EMPTY);
    load();
  }

  async function removeEmployee(id: string) {
    if (!confirm("Deactivate this employee?")) return;
    await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    load();
  }

  function openCreate() {
    setForm({ ...EMPTY, section: section || sections[0] || "Dyeing Operator" });
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setForm({ ...emp });
    setModalOpen(true);
  }

  function exportExcel() {
    const rows = employees.map((e, i) => ({
      SL: i + 1,
      "Pay Type": e.payType === "salary" ? "Salary" : "Wages",
      Status: e.status,
      "Card No": e.cardNo,
      "Employee Name": e.name,
      Designation: e.designation,
      Section: e.section,
      "Bank Account": e.bankAccount,
      "Joining Date": e.joiningDate,
      "Monthly Salary (12H)": round2(e.salary12),
      "Hour Factor": e.hourFactor === "same" ? "Same / Full" : String(e.hourFactor),
      Medical: e.medical,
      Conveyance: e.conveyance,
      Food: e.food,
      Phone: e.phone || "",
      Notes: e.notes || "",
    }));
    downloadExcel("Jhonstitch-Employees", [{ name: "Employees", rows }]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p>Master records</p>
          <h1>Employees</h1>
          <p>Card numbers, bank accounts, designations, and monthly salary (12H).</p>
        </div>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <ExcelDownloadButton
            onClick={exportExcel}
            label="Download Excel"
            disabled={!employees.length}
          />
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add employee
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="search">Search</label>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: 13, color: "#6b828c" }}
            />
            <input
              id="search"
              className="search-input"
              style={{ maxWidth: "100%", paddingLeft: 36 }}
              placeholder="Name, card, designation…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="section">Section</label>
          <select
            id="section"
            className="select-input"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payTypeFilter">Pay type</label>
          <select
            id="payTypeFilter"
            className="select-input"
            value={payType}
            onChange={(e) => setPayType(e.target.value)}
          >
            <option value="">All (Wages + Salary)</option>
            <option value="wages">Wages (factory floor)</option>
            <option value="salary">Salary (staff)</option>
          </select>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>
            {loading ? "Loading…" : `${employees.filter((e) => e.status === "active").length} active`}
          </h2>
          <span className="badge badge-muted">{employees.length} total</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Name</th>
                <th>Type</th>
                <th>Section</th>
                <th>Designation</th>
                <th>Joined</th>
                <th className="num">Monthly</th>
                <th>Factor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      Loading Excel employee list… first compile can take up to a minute.
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                employees.map((emp) => (
                <tr key={emp.id} style={{ opacity: emp.status === "inactive" ? 0.55 : 1 }}>
                  <td>{emp.cardNo}</td>
                  <td>
                    <strong>{emp.name}</strong>
                    <div style={{ fontSize: "0.75rem", color: "#6b828c" }}>
                      {emp.bankAccount || "No bank account"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        emp.payType === "salary" ? "badge-gold" : "badge-teal"
                      }`}
                    >
                      {emp.payType === "salary" ? "Salary" : "Wages"}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-muted">{emp.section}</span>
                  </td>
                  <td>{emp.designation}</td>
                  <td>{formatDate(emp.joiningDate)}</td>
                  <td className="num">{formatBDTCurrency(emp.salary12)}</td>
                  <td>
                    {emp.payType === "salary"
                      ? "Full"
                      : emp.hourFactor === "same"
                        ? "Same"
                        : `${emp.hourFactor}H`}
                  </td>
                  <td>
                    <span
                      className={`badge ${emp.status === "active" ? "badge-success" : "badge-muted"}`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ minHeight: 36, padding: "0.3rem 0.55rem" }}
                        onClick={() => openEdit(emp)}
                        aria-label={`Edit ${emp.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      {emp.status === "active" && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ minHeight: 36, padding: "0.3rem 0.55rem", color: "#b42318" }}
                          onClick={() => removeEmployee(emp.id)}
                          aria-label={`Deactivate ${emp.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      No employees found. Go to Settings → Reload Excel seed data.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emp-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="emp-modal-title">{form.id ? "Edit employee" : "Add employee"}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveEmployee}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input
                      id="name"
                      required
                      value={form.name || ""}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cardNo">Card no</label>
                    <input
                      id="cardNo"
                      required
                      value={form.cardNo || ""}
                      onChange={(e) => setForm({ ...form, cardNo: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="section">Section</label>
                    <input
                      id="section"
                      list="section-list"
                      required
                      value={form.section || ""}
                      onChange={(e) => setForm({ ...form, section: e.target.value })}
                    />
                    <datalist id="section-list">
                      {sections.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div className="field">
                    <label htmlFor="payType">Pay type</label>
                    <select
                      id="payType"
                      value={form.payType || "wages"}
                      onChange={(e) => {
                        const pt = e.target.value === "salary" ? "salary" : "wages";
                        setForm({
                          ...form,
                          payType: pt,
                          hourFactor: pt === "salary" ? "same" : form.hourFactor || 11.5,
                        });
                      }}
                    >
                      <option value="wages">Wages (OT + 12H→8H)</option>
                      <option value="salary">Salary (staff, no OT)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="designation">Designation</label>
                    <input
                      id="designation"
                      required
                      value={form.designation || ""}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="bank">Bank account</label>
                    <input
                      id="bank"
                      value={form.bankAccount || ""}
                      onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="joining">Joining date</label>
                    <input
                      id="joining"
                      type="date"
                      value={form.joiningDate || ""}
                      onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="salary12">Monthly salary (12H)</label>
                    <input
                      id="salary12"
                      type="number"
                      min={0}
                      required
                      value={form.salary12 ?? 0}
                      onChange={(e) => setForm({ ...form, salary12: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="hourFactor">Hour factor</label>
                    <select
                      id="hourFactor"
                      value={String(form.hourFactor)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({
                          ...form,
                          hourFactor: v === "same" ? "same" : (Number(v) as HourFactor),
                        });
                      }}
                    >
                      <option value="11.5">11.5H → 8H (operators/helpers)</option>
                      <option value="11">11H → 8H (loaders/lab)</option>
                      <option value="same">Same 12H & 8H (special)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="medical">Medical</label>
                    <input
                      id="medical"
                      type="number"
                      value={form.medical ?? 750}
                      onChange={(e) => setForm({ ...form, medical: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="conveyance">Conveyance</label>
                    <input
                      id="conveyance"
                      type="number"
                      value={form.conveyance ?? 450}
                      onChange={(e) => setForm({ ...form, conveyance: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="food">Food allowance</label>
                    <input
                      id="food"
                      type="number"
                      value={form.food ?? 1250}
                      onChange={(e) => setForm({ ...form, food: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={form.status || "active"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value === "inactive" ? "inactive" : "active",
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>
                  Auto breakdown · 8H {formatBDTCurrency(preview.salary8, 2)} · Basic{" "}
                  {formatBDTCurrency(preview.basic, 2)} · House{" "}
                  {formatBDTCurrency(preview.houseRent, 2)} · OT rate{" "}
                  {formatBDTCurrency(preview.otRate, 2)}/hr
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
