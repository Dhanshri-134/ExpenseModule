"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { ChevronRightIcon } from "@/components/dashboard/icons";
import { ExpenseChartsSection } from "@/features/expenses/components/ExpenseChartsSection";
import { ExpenseDetailsContent, ExpenseRegisterSection } from "@/features/expenses/components/ExpenseRegisterSection";
import { ExpenseFiltersPanel } from "@/features/expenses/components/ExpenseFiltersPanel";
import { useExpenseMutations } from "@/features/expenses/hooks/useExpenseMutations";
import { useProjectExpenses } from "@/features/expenses/hooks/useProjectExpenses";
import { useExpenseViewState } from "@/features/expenses/hooks/useExpenseViewState";
import { ExpenseSummaryCards } from "@/features/expenses/components/ExpenseSummaryCards";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass() {
  return "acm-input mt-0";
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

function createExpenseForm(projectId = "") {
  return {
    id: "",
    projectId,
    expenseType: "material",
    status: "approved",
    partyName: "",
    amount: "",
    quantity: "",
    unitRate: "",
    markupPercent: "",
    note: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    vendor: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    receiptUrl: "",
    details: {
      materialName: "",
      rentalCost: "",
      fuelCost: "",
    },
  };
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeAmount(form) {
  if (form.expenseType === "employee_labor") {
    const base = toNumber(form.quantity) * toNumber(form.unitRate);
    return base + (base * toNumber(form.markupPercent)) / 100;
  }
  if (form.expenseType === "material" && form.quantity && form.unitRate) {
    return toNumber(form.quantity) * toNumber(form.unitRate);
  }
  if (form.expenseType === "equipment") {
    return toNumber(form.details.rentalCost) + toNumber(form.details.fuelCost);
  }
  return toNumber(form.amount);
}

function formatTypeLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ProjectBudgetCards({ totals }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {totals.projectSummaries.slice(0, 6).map((project) => (
        <div key={project.id || project.name} className={cardClass()}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">{project.name}</div>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--acm-fg)]">
            <div className="flex items-center justify-between gap-3"><span>Budget</span><span className="font-semibold">{formatCurrency(project.budget)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Spent</span><span className="font-semibold">{formatCurrency(project.spent)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Remaining</span><span className="font-semibold">{formatCurrency(project.remaining)}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectBudgetPreview({ totals, roleBase, onSeeMore }) {
  const router = useRouter();
  const previewProjects = totals.projectSummaries.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-[color:var(--acm-fg)]">Project List</div>
          {/* <div className="text-sm text-[color:var(--acm-muted-fg)]">Quick project budget and spending snapshot.</div> */}
        </div>
        <button type="button" onClick={onSeeMore} className="acm-btn acm-btn-secondary h-10 px-4">
          See More
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {previewProjects.map((project) => (
          <button
            key={project.id || project.name}
            type="button"
            onClick={() => router.push(`/${roleBase}/project/${project.id}/expenses`)}
            className={`${cardClass()} text-left transition hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">{project.name}</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)]">
                <ChevronRightIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-[color:var(--acm-fg)]">
              <div className="flex items-center justify-between gap-3"><span>Budget</span><span className="font-semibold">{formatCurrency(project.budget)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Spent</span><span className="font-semibold">{formatCurrency(project.spent)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Remaining</span><span className="font-semibold">{formatCurrency(project.remaining)}</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExpensePageHeader({ title, subtitle, onAddExpense }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-2xl font-bold text-[color:var(--acm-fg)]">{title}</div>
        <div className="text-sm text-[color:var(--acm-muted-fg)]">{subtitle}</div>
      </div>
      <button type="button" onClick={onAddExpense} className="acm-btn acm-btn-primary h-10 px-4">
        Add Expense
      </button>
    </div>
  );
}

function ProjectExpenseTable({ expenses, formatCurrency, formatDate }) {
  return (
    <div className={cardClass("overflow-hidden p-0")}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[color:var(--acm-accent-soft)] text-left text-[color:var(--acm-fg)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Payee / Vendor</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Entered By</th>
            </tr>
          </thead>
          <tbody>
            {!expenses.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--acm-muted-fg)]">
                  No expenses match the current filters.
                </td>
              </tr>
            ) : null}
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-t border-[color:var(--acm-border)]">
                <td className="px-4 py-3">{formatDate(expense.expense_date)}</td>
                <td className="px-4 py-3">{formatTypeLabel(expense.expense_type || expense.category)}</td>
                <td className="px-4 py-3">{expense.party_name || expense.vendor || "-"}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(expense.amount)}</td>
                <td className="px-4 py-3">{expense.reference_number || "-"}</td>
                <td className="px-4 py-3">{expense.created_by?.name || expense.created_by?.user_name || expense.created_by?.user_code || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DynamicExpenseFields({ form, setForm }) {
  if (form.expenseType === "employee_labor") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledField label="Employee Name">
          <input className={fieldClass()} value={form.partyName} onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Hours">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Target Wage">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.unitRate} onChange={(event) => setForm((current) => ({ ...current, unitRate: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Markup %">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.markupPercent} onChange={(event) => setForm((current) => ({ ...current, markupPercent: event.target.value }))} />
        </LabeledField>
      </div>
    );
  }

  if (form.expenseType === "subcontractor") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledField label="Subcontractor Name">
          <input className={fieldClass()} value={form.partyName} onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Rate / Amount">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
        </LabeledField>
      </div>
    );
  }

  if (form.expenseType === "material") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledField label="Vendor">
          <input className={fieldClass()} value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Material Name">
          <input className={fieldClass()} value={form.details.materialName} onChange={(event) => setForm((current) => ({ ...current, details: { ...current.details, materialName: event.target.value } }))} />
        </LabeledField>
        <LabeledField label="Quantity">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
        </LabeledField>
        <LabeledField label="Unit Rate">
          <input type="number" min="0" step="0.01" className={fieldClass()} value={form.unitRate} onChange={(event) => setForm((current) => ({ ...current, unitRate: event.target.value }))} />
        </LabeledField>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <LabeledField label="Equipment Name">
        <input className={fieldClass()} value={form.partyName} onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))} />
      </LabeledField>
      <LabeledField label="Rental Cost">
        <input type="number" min="0" step="0.01" className={fieldClass()} value={form.details.rentalCost} onChange={(event) => setForm((current) => ({ ...current, details: { ...current.details, rentalCost: event.target.value } }))} />
      </LabeledField>
      <LabeledField label="Fuel Cost">
        <input type="number" min="0" step="0.01" className={fieldClass()} value={form.details.fuelCost} onChange={(event) => setForm((current) => ({ ...current, details: { ...current.details, fuelCost: event.target.value } }))} />
      </LabeledField>
    </div>
  );
}

function ExpensesModulePage({ lockedProjectId = "", roleBase = "employee", currentUserId = "" }) {
  const { filters, setFilters } = useExpenseViewState();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState(() => createExpenseForm(lockedProjectId));
  const overviewData = useProjectExpenses({
    projectId: lockedProjectId || undefined,
    filters: lockedProjectId ? { projectId: lockedProjectId } : {},
  });
  const listData = useProjectExpenses({
    projectId: lockedProjectId || undefined,
    filters: lockedProjectId ? { ...filters, projectId: lockedProjectId } : filters,
  });
  const { query: expensesQuery, queryUrl, expenses, projects, expenseTypes, enteredByOptions } = listData;
  const statusOptions = listData.statusOptions;
  const totals = overviewData.totals;
  const { saveExpense: persistExpense, deleteExpense: removeExpense } = useExpenseMutations({ projectId: lockedProjectId || undefined });
  const canManageAll = roleBase === "owner" || roleBase === "manager";
  const canCreateExpenses = projects.length > 0 || Boolean(lockedProjectId);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === lockedProjectId) ?? null,
    [lockedProjectId, projects]
  );

  const canEdit = useCallback((expense) => {
    if (!expense) return false;
    if (canManageAll) return true;
    return expense.created_by_user_id === currentUserId;
  }, [canManageAll, currentUserId]);

  const openCreate = useCallback(() => {
    setForm(createExpenseForm(lockedProjectId || ""));
    setOpen(true);
    setError("");
    setMessage("");
  }, [lockedProjectId]);

  const openEdit = useCallback((expense) => {
    setForm({
      id: expense.id,
      projectId: expense.project_id || lockedProjectId || "",
      expenseType: expense.expense_type || "material",
      status: expense.status || "approved",
      partyName: expense.party_name || "",
      amount: expense.amount ?? "",
      quantity: expense.quantity ?? "",
      unitRate: expense.unit_rate ?? "",
      markupPercent: expense.markup_percent ?? "",
      note: expense.note || "",
      expenseDate: expense.expense_date || new Date().toISOString().slice(0, 10),
      vendor: expense.vendor || "",
      paymentMethod: expense.payment_method || "Cash",
      referenceNumber: expense.reference_number || "",
      receiptUrl: expense.receipt_url || "",
      details: {
        materialName: expense.details?.materialName || "",
        rentalCost: expense.details?.rentalCost || "",
        fuelCost: expense.details?.fuelCost || "",
      },
    });
    setSelectedExpense(null);
    setOpen(true);
    setError("");
    setMessage("");
  }, [lockedProjectId]);

  const saveExpense = useCallback(async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const nextAmount = computeAmount(form);
      await persistExpense({
        ...form,
        amount: nextAmount,
        projectId: form.projectId || lockedProjectId,
      });
      setOpen(false);
      setMessage(form.id ? "Expense updated." : "Expense added.");
    } catch (requestError) {
      setError(requestError.message || "expense_save_failed");
    } finally {
      setBusy(false);
    }
  }, [busy, form, lockedProjectId, persistExpense]);

  const deleteExpense = useCallback(async (expense) => {
    if (!window.confirm(`Delete expense for ${formatCurrency(expense.amount)}?`)) return;
    setError("");
    setMessage("");
    try {
      await removeExpense({ id: expense.id, activeProjectId: expense.project_id || lockedProjectId });
      if (selectedExpense?.id === expense.id) setSelectedExpense(null);
      setMessage("Expense deleted.");
    } catch (requestError) {
      setError(requestError.message || "expense_delete_failed");
    }
  }, [lockedProjectId, removeExpense, selectedExpense]);

  const exportPdf = useCallback(() => {
    const url = new URL(queryUrl || "/api/project-expenses", window.location.origin);
    url.searchParams.set("export", "pdf");
    url.searchParams.set("disposition", "attachment");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [queryUrl]);

  const computedAmount = useMemo(() => computeAmount(form), [form]);

  return (
    <>
      <div className="space-y-4">
        <InlineMessage error={expensesQuery.error || error} message={message} onDismiss={() => { setError(""); setMessage(""); }} />

        <ExpensePageHeader
          title={lockedProjectId ? `${activeProject?.name || "Project"} Expenses` : null}
          // subtitle={lockedProjectId ? "Project expense register with statistics and filters." : "Centralized expense overview with project list and expense stats."}
          onAddExpense={openCreate}
        />
        <ExpenseSummaryCards totals={totals} formatCurrency={formatCurrency} />
        {lockedProjectId ? null : <ProjectBudgetPreview totals={totals} roleBase={roleBase} onSeeMore={() => setProjectsOpen(true)} />}
        {/* <ExpenseChartsSection totals={totals} formatCurrency={formatCurrency} cardClass={cardClass} /> */}
        <ExpenseFiltersPanel
          filters={lockedProjectId ? { ...filters, projectId: lockedProjectId } : filters}
          setFilters={setFilters}
          projects={projects}
          expenseTypes={expenseTypes}
          enteredByOptions={enteredByOptions}
          cardClass={cardClass}
          fieldClass={fieldClass}
        />
        {lockedProjectId ? (
          <>
            <div className="flex justify-end">
              <button type="button" onClick={exportPdf} className="acm-btn acm-btn-secondary h-10 px-4">
                Export PDF
              </button>
            </div>
            <ProjectExpenseTable expenses={expenses} formatCurrency={formatCurrency} formatDate={formatDate} />
          </>
        ) : (
          <ExpenseRegisterSection
            expenses={expenses}
            canCreateExpenses={canCreateExpenses}
            canEdit={canEdit}
            setSelectedExpense={setSelectedExpense}
            openCreate={openCreate}
            openEdit={openEdit}
            deleteExpense={deleteExpense}
            exportPdf={exportPdf}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            cardClass={cardClass}
            hideAddButton
          />
        )}
      </div>

      <Modal open={open} title={form.id ? "Edit Expense" : "Add Expense"} onClose={() => setOpen(false)}>
        <form onSubmit={saveExpense} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="Project">
              <select className={fieldClass()} value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} disabled={Boolean(lockedProjectId)}>
                <option value="">Select Project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Expense Type">
              <select className={fieldClass()} value={form.expenseType} onChange={(event) => setForm((current) => ({ ...current, expenseType: event.target.value }))}>
                {expenseTypes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Status">
              <select className={fieldClass()} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {statusOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Date">
              <input type="date" className={fieldClass()} value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            </LabeledField>
          </div>

          <DynamicExpenseFields form={form} setForm={setForm} />

          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="Payment Method">
              <select className={fieldClass()} value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                {["Cash", "Card", "Bank Transfer", "Cheque", "UPI", "Petty Cash"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Reference">
              <input className={fieldClass()} value={form.referenceNumber} onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} />
            </LabeledField>
          </div>

          <LabeledField label="Description / Note">
            <textarea className={fieldClass()} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={4} />
          </LabeledField>

          <div className={cardClass("p-4")}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Total Amount</div>
            <div className="mt-2 text-2xl font-bold text-[color:var(--acm-fg)]">{formatCurrency(computedAmount)}</div>
            <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{formatTypeLabel(form.expenseType)}</div>
          </div>

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
            <ExpenseDetailsContent expense={selectedExpense} formatCurrency={formatCurrency} formatDate={formatDate} />
            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4 text-sm text-[color:var(--acm-fg)]">
              {selectedExpense.note || "No note"}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={projectsOpen} title="All Projects" onClose={() => setProjectsOpen(false)} maxWidth="max-w-5xl">
        <div className="grid gap-4 md:grid-cols-2">
          {totals.projectSummaries.map((project) => (
            <button
              key={project.id || project.name}
              type="button"
              onClick={() => {
                setProjectsOpen(false);
                router.push(`/${roleBase}/project/${project.id}/expenses`);
              }}
              className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-4 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-[color:var(--acm-fg)]">{project.name}</div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)]">
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
                Budget {formatCurrency(project.budget)} | Spent {formatCurrency(project.spent)} | Remaining {formatCurrency(project.remaining)}
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export function ProjectExpensesPage({ projectId, roleBase = "employee", currentUserId = "" }) {
  return <ExpensesModulePage lockedProjectId={projectId} roleBase={roleBase} currentUserId={currentUserId} />;
}

export function ExpensesWorkspacePage({ roleBase = "owner", currentUserId = "" }) {
  return <ExpensesModulePage roleBase={roleBase} currentUserId={currentUserId} />;
}
