import { memo } from "react";

function SummaryCard({ label, value, note }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="mt-3 text-3xl font-bold text-[color:var(--acm-fg)]">{value}</div>
      <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{note}</div>
    </div>
  );
}

const capitalizeFirst = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

function ExpenseSummaryCardsComponent({ totals, formatCurrency }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <SummaryCard label="Total Expense" value={formatCurrency(totals.totalAmount)} note={`${totals.totalEntries} entries`} />
      <SummaryCard label="Budget Used" value={formatCurrency(totals.totalAmount)} note={`${totals.budgetUsedPercent?.toFixed?.(1) || "0.0"}% of visible budget`} />
      <SummaryCard label="Remaining Budget" value={formatCurrency(totals.remainingBudget)} note={`Budget ${formatCurrency(totals.totalBudget || 0)}`} />
      {/* <SummaryCard label="Top Expense Type" value={totals.topCategories[0]?.label || "-"} note={formatCurrency(totals.topCategories[0]?.value || 0)} /> */}
      <SummaryCard
  label="Top Expense Type"
  value={capitalizeFirst(
    totals.topCategories[0]?.label || "-"
  )}
  note={formatCurrency(totals.topCategories[0]?.value || 0)}
/>
    </div>
  );
}

export const ExpenseSummaryCards = memo(ExpenseSummaryCardsComponent);
