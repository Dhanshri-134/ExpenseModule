import { memo } from "react";

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

function ExpenseFiltersPanelComponent({
  filters,
  setFilters,
  projects,
  expenseTypes,
  enteredByOptions,
  cardClass,
  fieldClass,
}) {
  return (
    <div className={cardClass()}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
        <LabeledField label="Search">
          <input className={fieldClass()} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Project, type, vendor, employee, date, user" />
        </LabeledField>
        <LabeledField label="Project">
          <select className={fieldClass()} value={filters.projectId} onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}>
            <option value="all">All Projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Expense Type">
          <select className={fieldClass()} value={filters.expenseType} onChange={(event) => setFilters((current) => ({ ...current, expenseType: event.target.value }))}>
            <option value="all">All Types</option>
            {expenseTypes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
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
  );
}

export const ExpenseFiltersPanel = memo(ExpenseFiltersPanelComponent);
