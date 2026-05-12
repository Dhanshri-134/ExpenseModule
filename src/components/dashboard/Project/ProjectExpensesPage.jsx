"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";
import { sendJson } from "@/lib/client/apiClient";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass() {
  return "acm-input mt-0";
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function LabeledField({ label, children }) {
  return (
    <label className="relative block pt-3">
      <span className="absolute left-3 top-0 z-10 bg-[color:var(--acm-surface)] px-2 text-xs font-semibold text-[color:var(--acm-muted-fg)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function InlineMessage({ error, message, onDismiss }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-500">
        <div className="flex items-start justify-between gap-3">
          <span>{error}</span>
          {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
        </div>
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
        <div className="flex items-start justify-between gap-3">
          <span>{message}</span>
          {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
        </div>
      </div>
    );
  }

  return null;
}

function formatApiError(json, fallback) {
  if (json?.detail?.fieldErrors) {
    const fieldMessages = Object.values(json.detail.fieldErrors).flat().filter(Boolean);
    if (fieldMessages.length) return fieldMessages[0];
  }
  if (typeof json?.detail === "string" && json.detail.trim()) return json.detail;
  if (typeof json?.error === "string" && json.error.trim()) return json.error;
  return fallback;
}

function formatCurrency(value) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function createExpenseForm(projectId) {
  return {
    id: "",
    projectId,
    category: "Materials",
    amount: "",
    note: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    vendor: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    receiptUrl: "",
  };
}

function buildQuery(projectId, filters) {
  const params = new URLSearchParams({ projectId });
  if (filters.search) params.set("search", filters.search);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.createdByUserId && filters.createdByUserId !== "all") params.set("createdByUserId", filters.createdByUserId);
  return `/api/project-expenses?${params.toString()}`;
}

function MiniBarChart({ items = [] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className="space-y-3">
      {items.length ? items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-[color:var(--acm-fg)]">{item.label}</span>
            <span className="text-[color:var(--acm-muted-fg)]">{formatCurrency(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--acm-border)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0f3b66,#5fa8d3)]"
              style={{ width: `${maxValue ? Math.max((item.value / maxValue) * 100, 6) : 0}%` }}
            />
          </div>
        </div>
      )) : <div className="text-sm text-[color:var(--acm-muted-fg)]">No expense data yet.</div>}
    </div>
  );
}

function DonutChart({ total = 0, items = [] }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const colors = ["#0f3b66", "#2f6690", "#3a7ca5", "#5fa8d3", "#81c3d7", "#16425b"];
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="18" />
        {items.map((item, index) => {
          const ratio = total ? item.value / total : 0;
          const dash = circumference * ratio;
          const segment = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 70 70)"
            />
          );
          offset += dash;
          return segment;
        })}
        <text x="70" y="64" textAnchor="middle" className="fill-[color:var(--acm-muted-fg)] text-[10px] font-semibold">TOTAL</text>
        <text x="70" y="82" textAnchor="middle" className="fill-[color:var(--acm-fg)] text-[12px] font-bold">
          {total ? formatCurrency(total) : "$0"}
        </text>
      </svg>

      <div className="grid gap-2 text-sm">
        {items.length ? items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            <span className="text-[color:var(--acm-fg)]">{item.label}</span>
          </div>
        )) : <div className="text-[color:var(--acm-muted-fg)]">No category split yet.</div>}
      </div>
    </div>
  );
}

export function ProjectExpensesPage({ projectId, roleBase = "employee", currentUserId = "" }) {
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    startDate: "",
    endDate: "",
    createdByUserId: "all",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState(() => createExpenseForm(projectId));
  const queryKey = buildQuery(projectId, filters);
  const expensesQuery = useApiQuery(projectId ? queryKey : null);

  const expenses = expensesQuery.data?.expenses ?? [];
  const categories = expensesQuery.data?.categories ?? [];
  const canCreateExpenses = Boolean(projectId);
  const canManageAll = roleBase === "owner" || roleBase === "manager";
  const enteredByOptions = useMemo(() => {
    const map = new Map();
    expenses.forEach((expense) => {
      if (!expense.created_by_user_id) return;
      map.set(
        expense.created_by_user_id,
        expense.created_by?.name || expense.created_by?.user_name || expense.created_by?.user_code || "Team Member"
      );
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [expenses]);

  const totals = useMemo(() => {
    const totalAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const categoryMap = new Map();
    const monthlyMap = new Map();

    expenses.forEach((expense) => {
      const amount = Number(expense.amount || 0);
      categoryMap.set(expense.category, (categoryMap.get(expense.category) || 0) + amount);
      const monthKey = String(expense.expense_date || "").slice(0, 7);
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
    });

    return {
      totalAmount,
      totalEntries: expenses.length,
      averageAmount: expenses.length ? totalAmount / expenses.length : 0,
      topCategories: Array.from(categoryMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      monthlySpend: Array.from(monthlyMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .slice(-6),
    };
  }, [expenses]);

  function canEdit(expense) {
    if (!expense) return false;
    if (canManageAll) return true;
    return expense.created_by_user_id === currentUserId;
  }

  function openCreate() {
    setForm(createExpenseForm(projectId));
    setOpen(true);
    setError("");
    setMessage("");
  }

  function openEdit(expense) {
    setForm({
      id: expense.id,
      projectId,
      category: expense.category || categories[0] || "Materials",
      amount: expense.amount ?? "",
      note: expense.note || "",
      expenseDate: expense.expense_date || new Date().toISOString().slice(0, 10),
      vendor: expense.vendor || "",
      paymentMethod: expense.payment_method || "Cash",
      referenceNumber: expense.reference_number || "",
      receiptUrl: expense.receipt_url || "",
    });
    setSelectedExpense(null);
    setOpen(true);
    setError("");
    setMessage("");
  }

  async function saveExpense(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await sendJson("/api/project-expenses", {
        method: form.id ? "PUT" : "POST",
        body: form,
      });
      setOpen(false);
      setMessage(form.id ? "Expense updated." : "Expense added.");
      invalidateApiQuery(queryKey);
      await expensesQuery.refresh();
    } catch (requestError) {
      setError(formatApiError(requestError.payload, "expense_save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete expense for ${formatCurrency(expense.amount)}?`)) return;
    setError("");
    setMessage("");
    try {
      await sendJson("/api/project-expenses", {
        method: "DELETE",
        body: { id: expense.id, projectId },
      });
      if (selectedExpense?.id === expense.id) setSelectedExpense(null);
      setMessage("Expense deleted.");
      invalidateApiQuery(queryKey);
      await expensesQuery.refresh();
    } catch (requestError) {
      setError(formatApiError(requestError.payload, "expense_delete_failed"));
    }
  }

  function exportPdf() {
    const url = `${buildQuery(projectId, filters)}&export=pdf&disposition=attachment`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="space-y-4">
        <InlineMessage error={expensesQuery.error || error} message={message} onDismiss={() => { setError(""); setMessage(""); }} />

        <div className="grid gap-4 xl:grid-cols-3">
          <div className={cardClass()}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Total Expense</div>
            <div className="mt-3 text-3xl font-bold text-[color:var(--acm-fg)]">{formatCurrency(totals.totalAmount)}</div>
            <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{totals.totalEntries} entries</div>
          </div>

          <div className={cardClass()}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Average Entry</div>
            <div className="mt-3 text-3xl font-bold text-[color:var(--acm-fg)]">{formatCurrency(totals.averageAmount)}</div>
            <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">Filtered results</div>
          </div>

          <div className={cardClass()}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Top Category</div>
            <div className="mt-3 text-3xl font-bold text-[color:var(--acm-fg)]">{totals.topCategories[0]?.label || "-"}</div>
            <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{formatCurrency(totals.topCategories[0]?.value || 0)}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className={cardClass()}>
            <SectionHeader title="Expense Trends" />
            <MiniBarChart
              items={totals.monthlySpend.map((item) => ({
                label: item.label || "Current",
                value: item.value,
              }))}
            />
          </div>

          <div className={cardClass()}>
            <SectionHeader title="Category Split" />
            <DonutChart total={totals.totalAmount} items={totals.topCategories} />
          </div>
        </div>

        <div className={cardClass()}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <LabeledField label="Search">
              <input className={fieldClass()} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Category, note, vendor, date, user" />
            </LabeledField>
            <LabeledField label="Category">
              <select className={fieldClass()} value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">All Categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Start Date">
              <input type="date" className={fieldClass()} value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
            </LabeledField>
            <LabeledField label="End Date">
              <input type="date" className={fieldClass()} value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
            </LabeledField>
            <LabeledField label="Entered By">
              <select className={fieldClass()} value={filters.createdByUserId} onChange={(event) => setFilters((current) => ({ ...current, createdByUserId: event.target.value }))}>
                <option value="all">All Users</option>
                {enteredByOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </LabeledField>
          </div>
        </div>

        <div className={cardClass()}>
          <SectionHeader
            title="Expense Register"
            action={(
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportPdf} className="acm-btn acm-btn-secondary h-10 px-4">
                  Export PDF
                </button>
                {canCreateExpenses ? (
                  <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
                    Add Expense
                  </button>
                ) : null}
              </div>
            )}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {!expenses.length ? (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-2">
                No expenses match the current filters.
              </div>
            ) : null}

            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                <CompactListRow
                  primary={`${expense.category || "Expense"} • ${formatCurrency(expense.amount)}`}
                  secondary={
                    <>
                      {expense.note || "No note"}
                      <br />
                      {formatDate(expense.expense_date)} • {expense.vendor || "Vendor pending"}
                    </>
                  }
                  tertiary={
                    <>
                      {expense.payment_method || "Payment method pending"}
                      {expense.reference_number ? ` • Ref ${expense.reference_number}` : ""}
                      <br />
                      Entered by {expense.created_by?.name || expense.created_by?.user_name || expense.created_by?.user_code || "-"}
                    </>
                  }
                  onClick={() => setSelectedExpense(expense)}
                  actions={canEdit(expense) ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openEdit(expense); }} className="acm-btn acm-btn-secondary h-9 px-3 text-xs">
                        Edit
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); deleteExpense(expense); }} className="acm-btn acm-btn-secondary h-9 px-3 text-xs">
                        Delete
                      </button>
                    </div>
                  ) : null}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={open} title={form.id ? "Edit Expense" : "Add Expense"} onClose={() => setOpen(false)}>
        <form onSubmit={saveExpense} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="Category">
              <select className={fieldClass()} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Amount">
              <input type="number" min="0" step="0.01" className={fieldClass()} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </LabeledField>
            <LabeledField label="Date">
              <input type="date" className={fieldClass()} value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            </LabeledField>
            <LabeledField label="Payment Method">
              <select className={fieldClass()} value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                {["Cash", "Card", "Bank Transfer", "Cheque", "UPI", "Petty Cash"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Vendor">
              <input className={fieldClass()} value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
            </LabeledField>
            <LabeledField label="Reference">
              <input className={fieldClass()} value={form.referenceNumber} onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} />
            </LabeledField>
          </div>

          <LabeledField label="Note">
            <textarea className={fieldClass()} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={4} />
          </LabeledField>

          <BusyButton type="submit" busy={busy} className="acm-btn acm-btn-primary">
            {form.id ? "Save Expense" : "Create Expense"}
          </BusyButton>
        </form>
      </Modal>

      <Modal open={Boolean(selectedExpense)} title="Expense Details" onClose={() => setSelectedExpense(null)}>
        {selectedExpense ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {canEdit(selectedExpense) ? (
                <>
                  <button type="button" onClick={() => openEdit(selectedExpense)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Edit Expense
                  </button>
                  <button type="button" onClick={() => deleteExpense(selectedExpense)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Delete Expense
                  </button>
                </>
              ) : null}
            </div>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Category</div><div>{selectedExpense.category || "-"}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Amount</div><div>{formatCurrency(selectedExpense.amount)}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Date</div><div>{formatDate(selectedExpense.expense_date)}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Vendor</div><div>{selectedExpense.vendor || "-"}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Payment</div><div>{selectedExpense.payment_method || "-"}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Reference</div><div>{selectedExpense.reference_number || "-"}</div></div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Entered By</div><div>{selectedExpense.created_by?.name || selectedExpense.created_by?.user_name || selectedExpense.created_by?.user_code || "-"}</div></div>
            </div>
            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4 text-sm text-[color:var(--acm-fg)]">
              {selectedExpense.note || "No note"}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function ExpensesWorkspacePage({ roleBase = "owner", currentUserId = "" }) {
  const projectsQuery = useApiQuery("/api/projects");
  const projectList = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data?.projects]);
  const [projectId, setProjectId] = useState("");
  const activeProjectId = projectId || projectList[0]?.id || "";

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
          <LabeledField label="Project">
            <select className={fieldClass()} value={activeProjectId} onChange={(event) => setProjectId(event.target.value)}>
              {projectList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
      </div>

      {activeProjectId ? (
        <ProjectExpensesPage projectId={activeProjectId} roleBase={roleBase} currentUserId={currentUserId} />
      ) : (
        <div className={cardClass()}>No projects available yet.</div>
      )}
    </div>
  );
}
