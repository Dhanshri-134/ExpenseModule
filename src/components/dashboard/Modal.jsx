"use client";

export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-3)] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.18)] max-h-[calc(100vh-2rem)]">
        <div className="mb-4 flex items-center justify-between gap-4 shrink-0">
          <h2 className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--acm-border)] px-3 py-1 text-sm font-semibold text-[color:var(--acm-fg)]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
