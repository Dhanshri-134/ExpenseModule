"use client";

import { memo } from "react";

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function FieldReportDetailsPanelComponent({
  selectedReport,
  canEdit,
  onEdit,
  onDelete,
  useDetailedInspectionForm,
  formatDate,
}) {
  if (!selectedReport) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canEdit(selectedReport) ? (
          <>
            <button type="button" onClick={() => onEdit(selectedReport)} className="acm-btn acm-btn-secondary h-10 px-4">
              Edit Report
            </button>
            <button type="button" onClick={() => onDelete(selectedReport)} className="acm-btn acm-btn-secondary h-10 px-4">
              Delete Report
            </button>
          </>
        ) : null}
      </div>
      <div className="space-y-2">
        <DetailRow label="Date" value={formatDate(selectedReport.report_date)} />
        <DetailRow label="Time" value={selectedReport.report_time || "-"} />
        <DetailRow label="Location" value={selectedReport.location || "-"} />
        <DetailRow label="Weather" value={selectedReport.weather_conditions || "-"} />
        <DetailRow label="Temperature" value={selectedReport.temperature_range || "-"} />
        <DetailRow label="Impact" value={selectedReport.weather_impact || "-"} />
        <DetailRow label="Comments" value={selectedReport.comments || "-"} />
        <DetailRow label="Signoff" value={[selectedReport.signoff_name || "-", selectedReport.signoff_role || "-"].join(", ")} />
      </div>

      {useDetailedInspectionForm ? (
        <>
          <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
            <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Communications With Public</div>
            <div className="grid gap-3 md:grid-cols-2">
              {(selectedReport.public_communications ?? []).length ? (selectedReport.public_communications ?? []).map((entry, index) => (
                <div key={`public-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-3 text-sm">
                  <div className="font-semibold">{entry.name || "-"}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.phoneNumber || "-"}</div>
                  <div className="mt-2">{entry.comments || "-"}</div>
                </div>
              )) : <div className="text-sm text-[color:var(--acm-muted-fg)]">No public communication entries.</div>}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Contractor Labor Force</div>
              <div className="space-y-2 text-sm">
                {(selectedReport.contractor_labor_force ?? []).length ? (selectedReport.contractor_labor_force ?? []).map((entry, index) => (
                  <div key={`labor-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                    <div className="font-semibold">{entry.classification || "-"}</div>
                    <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.personnel || "-"}</div>
                  </div>
                )) : <div className="text-[color:var(--acm-muted-fg)]">No labor entries.</div>}
              </div>
            </div>

            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Subcontractors Onsite</div>
              <div className="space-y-2 text-sm">
                {(selectedReport.subcontractors_onsite ?? []).length ? (selectedReport.subcontractors_onsite ?? []).map((entry, index) => (
                  <div key={`subcontractor-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                    <div className="font-semibold">{entry.companyName || "-"}</div>
                    <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.supervisor || "-"} | {entry.totalPersons || "-"} persons</div>
                  </div>
                )) : <div className="text-[color:var(--acm-muted-fg)]">No subcontractor entries.</div>}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
        <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Work Activity Logs</div>
        <div className="space-y-2 text-sm text-[color:var(--acm-fg)]">
          {(selectedReport.work_activities ?? []).map((entry, index) => (
            <div key={`work-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
              {entry.text || "-"}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
        <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Coordination Logs</div>
        <div className="space-y-2 text-sm text-[color:var(--acm-fg)]">
          {(selectedReport.coordination_logs ?? []).map((entry, index) => (
            <div key={`coordination-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
              {entry.text || "-"}
            </div>
          ))}
        </div>
      </div>

      {useDetailedInspectionForm ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
            <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Equipment Used Today</div>
            <div className="space-y-2 text-sm">
              {(selectedReport.equipment_used ?? []).length ? (selectedReport.equipment_used ?? []).map((entry, index) => (
                <div key={`equipment-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                  <div className="font-semibold">{entry.equipmentType || "-"}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.makeModel || "-"} | {entry.typeOfWork || "-"}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">Time In Use: {entry.timeInUse || "-"}</div>
                </div>
              )) : <div className="text-[color:var(--acm-muted-fg)]">No equipment entries.</div>}
            </div>
          </div>

          <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
            <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Materials Used Today</div>
            <div className="space-y-2 text-sm">
              {(selectedReport.materials_used ?? []).length ? (selectedReport.materials_used ?? []).map((entry, index) => (
                <div key={`materials-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                  <div className="font-semibold">{entry.type || "-"}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">Used: {entry.amountUsed || "-"}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">Remaining: {entry.amountRemaining || "-"}</div>
                </div>
              )) : <div className="text-[color:var(--acm-muted-fg)]">No material entries.</div>}
            </div>
          </div>
        </div>
      ) : null}

      {(selectedReport.site_pictures ?? []).length ? (
        <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
          <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Site Pictures</div>
          <div className="grid gap-3 md:grid-cols-2">
            {(selectedReport.site_pictures ?? []).map((image, index) => (
              <img key={`picture-view-${index}`} src={image} alt={`Field report ${index + 1}`} className="h-40 w-full rounded-[14px] object-cover" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const FieldReportDetailsPanel = memo(FieldReportDetailsPanelComponent);
