"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useApiQuery } from "@/lib/client/apiQuery";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "-";
  return date.toLocaleDateString();
}

function getStatusClass(status) {
  if (status === "done") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function getRefLabel(refType) {
  if (refType === "lead") return "Enquiry";
  if (refType === "client") return "Customer";
  if (refType === "task") return "Task";
  return "Follow-up";
}

export default function FollowUpsPage({ roleBase }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("today");
  const query = activeFilter === "all" ? "/api/followups" : `/api/followups?filter=${activeFilter}`;
  const followUps = useApiQuery(query);

  const grouped = useMemo(() => followUps.data?.followUps ?? [], [followUps.data?.followUps]);

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
              Follow-up List
            </div>
            <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-[color:var(--acm-fg)]">
              Track pending and completed follow-ups
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${roleBase}`)}
            className="acm-btn acm-btn-secondary h-10 px-4"
          >
            Back
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "completed", label: "Completed" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key)}
              className={`acm-btn ${activeFilter === item.key ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {followUps.error ? (
        <div className="acm-message-error">{followUps.error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map((item) => (
          <div
            key={item.id}
            className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
                  {getRefLabel(item.ref_type)}
                </div>
                <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">{formatDate(item.date)}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusClass(item.status)}`}>
                {item.status ?? "-"}
              </span>
            </div>

            <div className="mt-4 text-sm text-[color:var(--acm-fg)]">{item.note ?? "-"}</div>

            <div className="mt-4 grid gap-2 text-sm text-[color:var(--acm-muted-fg)]">
              <div>Created By: {item.createdBy?.name ?? "-"}</div>
              <div>Email: {item.createdBy?.email ?? "-"}</div>
              <div>Created At: {formatDate(item.created_at)}</div>
            </div>
          </div>
        ))}
      </div>

      {!followUps.loading && !grouped.length ? (
        <div className="rounded-[22px] border border-dashed border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-5 py-8 text-sm text-[color:var(--acm-muted-fg)]">
          No follow-ups found for this filter.
        </div>
      ) : null}
    </div>
  );
}
