"use client";

export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-[24px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--acm-border)] px-3 py-1 text-sm font-semibold text-[color:var(--acm-fg)]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

