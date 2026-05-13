"use client";

import { memo } from "react";
import { CompactListRow } from "@/components/dashboard/DashboardUi";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function FieldReportsArchivePanelComponent({
  searchQuery,
  onSearchChange,
  canCreateReports,
  onCreate,
  filteredReports,
  canEdit,
  onSelectReport,
  onEditReport,
  onDeleteReport,
  formatDate,
}) {
  return (
    <div className={cardClass()}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input className="acm-input mt-0" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search reports by location, weather, date, creator, or notes" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-lg font-bold text-[color:var(--acm-fg)]">Daily Inspection Archive</div>
          {canCreateReports ? (
            <button type="button" onClick={onCreate} className="acm-btn acm-btn-primary h-10 px-4">
              New Report
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {!filteredReports.length ? (
          <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-2">
            No field reports match the current search.
          </div>
        ) : null}

        {filteredReports.map((report) => (
          <div key={report.id} className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
            <CompactListRow
              primary={formatDate(report.report_date)}
              secondary={(
                <>
                  {report.location || "Site report"}
                  <br />
                  {report.report_time || "Time pending"}
                  <br />
                  {report.weather_conditions || "Weather pending"}
                </>
              )}
              tertiary={(
                <>
                  {report.temperature_range || "Temp pending"}
                  <br />
                  Created by {report.created_by?.name || report.created_by?.user_name || report.created_by?.user_code || "-"}
                  <br />
                  {report.work_activities?.length || 0} work logs, {(report.equipment_used ?? []).length || 0} equipment entries
                </>
              )}
              onClick={() => onSelectReport(report)}
              actions={canEdit(report) ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditReport(report);
                    }}
                    className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteReport(report);
                    }}
                    className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FieldReportsArchivePanel = memo(FieldReportsArchivePanelComponent);
