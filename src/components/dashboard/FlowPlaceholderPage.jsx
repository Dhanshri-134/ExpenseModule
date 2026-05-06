"use client";

export function FlowPlaceholderPage({ title, description }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
        <div className="mt-3 text-sm leading-6 text-[color:var(--acm-muted-fg)]">
          {description}
        </div>
      </div>

      <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
          Workflow
        </div>
        <div className="mt-4 grid gap-3">
          {["Leads", "Client", "Estimates", "Invoicing", "Project"].map((item, index) => (
            <div
              key={item}
              className={`rounded-[18px] border px-4 py-3 text-sm ${index === 3 ? "border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] text-[color:var(--acm-accent-strong)]" : "border-[color:var(--acm-border)] text-[color:var(--acm-fg)]"}`}
            >
              {index + 1}. {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
