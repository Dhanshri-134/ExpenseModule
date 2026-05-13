import { memo } from "react";

function formatExpenseTypeLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function ExpenseDetailsContentComponent({ expense, formatCurrency, formatDate }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Project</div><div>{expense.project?.name || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Expense Type</div><div>{formatExpenseTypeLabel(expense.expense_type || expense.category || "-")}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Payee</div><div>{expense.party_name || expense.vendor || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Amount</div><div>{formatCurrency(expense.amount)}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Date</div><div>{formatDate(expense.expense_date)}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Status</div><div>{expense.status || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Vendor</div><div>{expense.vendor || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Payment</div><div>{expense.payment_method || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Reference</div><div>{expense.reference_number || "-"}</div></div>
      <div className="grid grid-cols-[140px_1fr] gap-3 py-2"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Entered By</div><div>{expense.created_by?.name || expense.created_by?.user_name || expense.created_by?.user_code || "-"}</div></div>
    </div>
  );
}

function ExpenseRegisterSectionComponent({
  expenses,
  openCreate,
  exportPdf,
  formatCurrency,
  formatDate,
  cardClass,
  hideAddButton = false,
}) {
  return (
    <div className={cardClass("overflow-hidden")}>
      <SectionHeader
        title="Expense Register"
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportPdf} className="acm-btn acm-btn-secondary h-10 px-4">
              Export PDF
            </button>
            {!hideAddButton ? (
              <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
                Add Expense
              </button>
            ) : null}
          </div>
        )}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[color:var(--acm-border)] text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Expense Type</th>
              <th className="px-4 py-3 font-semibold">Payee / Vendor</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Entered By</th>
            </tr>
          </thead>
          <tbody>
            {!expenses.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[color:var(--acm-muted-fg)]">
                  No expenses match the current filters.
                </td>
              </tr>
            ) : null}
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-[color:var(--acm-border)]">
                <td className="px-4 py-3">{expense.project?.name || "-"}</td>
                <td className="px-4 py-3">{formatExpenseTypeLabel(expense.expense_type || expense.category || "-")}</td>
                <td className="px-4 py-3">{expense.party_name || expense.vendor || "-"}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(expense.amount)}</td>
                <td className="px-4 py-3">{formatDate(expense.expense_date)}</td>
                <td className="px-4 py-3">{expense.status || "-"}</td>
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

export const ExpenseRegisterSection = memo(ExpenseRegisterSectionComponent);
export const ExpenseDetailsContent = memo(ExpenseDetailsContentComponent);
