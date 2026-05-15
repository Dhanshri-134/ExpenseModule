"use client";

import { memo } from "react";
import { CompactListRow } from "@/components/dashboard/DashboardUi";

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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[260px] flex-1 md:max-w-md">
          <input className="acm-input mt-0 h-10" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search reports by project, location, weather, date, creator, or notes" />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canCreateReports ? (
            <button type="button" onClick={onCreate} className="acm-btn acm-btn-primary h-10 px-4">
              Add Report
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
                  {report.project?.name || "Project pending"}
                  <br />
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
    </section>
  );
}

export const FieldReportsArchivePanel = memo(FieldReportsArchivePanelComponent);
