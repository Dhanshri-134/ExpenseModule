"use client";

import Modal from "@/components/dashboard/Modal";
import { ChevronRightIcon, SpinnerIcon } from "@/components/dashboard/icons";

export function BusyButton({
  busy = false,
  disabled = false,
  className = "acm-btn acm-btn-primary",
  children,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={busy || disabled}
      className={`${className} ${(busy || disabled) ? "cursor-not-allowed opacity-70" : ""}`.trim()}
    >
      {busy ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function StatusMetricButton({ label, value, onClick, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-[color:var(--acm-accent-border)] bg-[color:var(--acm-hover)]"
          : "border-[color:var(--acm-bg)] bg-[color:var(--acm-surface-2)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border px-3 py-3 text-left transition hover:-translate-y-0.5 ${toneClass}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold tracking-tight text-[color:var(--acm-fg)]">{value}</div>
    </button>
  );
}

export function CompactListRow({
  primary,
  secondary,
  tertiary,
  onClick,
  actions,
}) {
  return (
    <div
      className={`grid w-full gap-3 rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3 text-left ${onClick ? "transition hover:-translate-y-0.5 hover:bg-[color:var(--acm-surface-2)]" : ""}`}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          {onClick ? (
            <button type="button" onClick={onClick} className="w-full min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-[color:var(--acm-fg)]">{primary}</div>
              {secondary ? (
                <div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                  {secondary}
                </div>
              ) : null}
            </button>
          ) : (
            <>
              <div className="truncate text-sm font-semibold text-[color:var(--acm-fg)]">{primary}</div>
              {secondary ? (
                <div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                  {secondary}
                </div>
              ) : null}
            </>
          )}
          {tertiary ? (
            onClick ? (
              <button type="button" onClick={onClick} className="mt-3 w-full text-left text-sm text-[color:var(--acm-muted-fg)]">
                {tertiary}
              </button>
            ) : (
              <div className="mt-3 text-sm text-[color:var(--acm-muted-fg)]">{tertiary}</div>
            )
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="rounded-full border border-[color:var(--acm-border)] p-2 text-[color:var(--acm-muted-fg)] transition hover:bg-[color:var(--acm-surface-2)]"
              aria-label="Open details"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DrilldownModal({
  open,
  title,
  items,
  emptyMessage,
  onClose,
  renderItem,
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        {items.length ? items.map(renderItem) : (
          <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </Modal>
  );
}
