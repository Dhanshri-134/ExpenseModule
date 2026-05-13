import { memo, useMemo } from "react";

const DONUT_COLORS = ["#0f3b66", "#2f6690", "#3a7ca5", "#5fa8d3", "#81c3d7", "#16425b"];

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function MiniBarChart({ items = [], formatCurrency }) {
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

function DonutChart({ total = 0, items = [], formatCurrency }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = useMemo(() => {
    const nextSegments = [];
    for (const [index, item] of items.entries()) {
      const ratio = total ? item.value / total : 0;
      const dash = circumference * ratio;
      const previousOffset = nextSegments.reduce((sum, segment) => sum + segment.dash, 0);
      nextSegments.push({
        label: item.label,
        stroke: DONUT_COLORS[index % DONUT_COLORS.length],
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: -previousOffset,
        dash,
      });
    }
    return nextSegments;
  }, [circumference, items, total]);

  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="18" />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={segment.stroke}
            strokeWidth="18"
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
            strokeLinecap="butt"
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="64" textAnchor="middle" className="fill-[color:var(--acm-muted-fg)] text-[10px] font-semibold">TOTAL</text>
        <text x="70" y="82" textAnchor="middle" className="fill-[color:var(--acm-fg)] text-[12px] font-bold">
          {total ? formatCurrency(total) : "$0"}
        </text>
      </svg>

      <div className="grid gap-2 text-sm">
        {items.length ? items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
            <span className="text-[color:var(--acm-fg)]">{item.label}</span>
          </div>
        )) : <div className="text-[color:var(--acm-muted-fg)]">No category split yet.</div>}
      </div>
    </div>
  );
}

function ExpenseChartsSectionComponent({ totals, formatCurrency, cardClass }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className={cardClass()}>
        <SectionHeader title="Expense Trends" />
        <MiniBarChart
          items={totals.monthlySpend.map((item) => ({ label: item.label || "Current", value: item.value }))}
          formatCurrency={formatCurrency}
        />
      </div>

      <div className={cardClass()}>
        <SectionHeader title="Category Split" />
        <DonutChart total={totals.totalAmount} items={totals.topCategories} formatCurrency={formatCurrency} />
      </div>
    </div>
  );
}

export const ExpenseChartsSection = memo(ExpenseChartsSectionComponent);
