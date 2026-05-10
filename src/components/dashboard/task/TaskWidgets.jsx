"use client";

import Image from "next/image";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";

export function StatusBadge({ status }) {
  const toneClass =
    status === "approved"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
      : status === "submitted"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700"
        : status === "rejected"
          ? "border-rose-500/25 bg-rose-500/10 text-rose-700"
          : "border-slate-300 bg-slate-100 text-slate-700";

  const label = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "-";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {label}
    </span>
  );
}

export function AppDialog({
  open,
  title,
  message,
  tone = "default",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  confirmBusy = false,
  hideCancel = false,
}) {
  const titleClass =
    tone === "danger"
      ? "text-rose-700"
      : tone === "success"
        ? "text-emerald-700"
        : "text-[color:var(--acm-fg)]";

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-5">
        <p className={`text-sm leading-6 ${titleClass}`}>{message}</p>
        <div className="flex justify-end gap-3">
          {!hideCancel ? (
            <button type="button" onClick={onClose} className="acm-btn acm-btn-secondary h-10 px-4">
              {cancelLabel}
            </button>
          ) : null}
          <BusyButton type="button" busy={confirmBusy} onClick={onConfirm} className="acm-btn acm-btn-primary h-10 px-4">
            {confirmLabel}
          </BusyButton>
        </div>
      </div>
    </Modal>
  );
}

export function UserSelector({
  users,
  selectedUserIds,
  onToggle,
  getLabel,
  error = "",
}) {
  return (
    <div className={`rounded-[18px] border p-4 ${error ? "border-rose-400 bg-rose-50/50" : "border-[color:var(--acm-border)]"}`}>
      <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Assign To</div>
      <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
        {users.length ? "Select one or more project members." : "No eligible users found for the selected project."}
      </div>
      <div className="mt-3 max-h-[320px] overflow-y-auto rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-2">
        <div className="grid gap-2">
          {users.map((item) => (
            <label key={item.user_id} className="flex items-start gap-3 rounded-[14px] border border-[color:var(--acm-border)] px-3 py-3">
              <input
                type="checkbox"
                checked={selectedUserIds.includes(item.user_id)}
                onChange={() => onToggle(item.user_id)}
              />
              <span className="text-sm text-[color:var(--acm-fg)]">{getLabel(item)}</span>
            </label>
          ))}
        </div>
      </div>
      {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
    </div>
  );
}

export function TaskCard({
  task,
  canEdit = false,
  canDelete = false,
  deleteBusy = false,
  onOpen,
  onEdit,
  onDelete,
  onSubmitAssignment,
  onReviewAssignment,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="w-full cursor-pointer rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.08)] transition hover:border-[color:var(--acm-accent-border)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xl font-bold text-[color:var(--acm-fg)]">
              {task.title ?? "-"}
            </div>

            <StatusBadge status={task.status} />
          </div>

          <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
            Project: {task.project?.name ?? "-"} | {task.dateRangeLabel}
          </div>

          <div className="mt-3 text-sm text-[color:var(--acm-fg)]">
            {task.description ?? "-"}
          </div>

          <div className="mt-4 text-sm text-[color:var(--acm-muted-fg)]">
            Assigned Users: {task.assignedUsersLabel}
          </div>

          <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
            Approving Person: {task.approverLabel} |{" "}
            {task.approvalRoleLabel}
          </div>

          {task.remarkLabel ? (
            <div className="mt-2 text-sm text-rose-700">
              Remark: {task.remarkLabel}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
          {canEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
            >
              Edit
            </button>
          ) : null}

          {canDelete ? (
            <BusyButton
              type="button"
              busy={deleteBusy}
              className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </BusyButton>
          ) : null}

          {(task.my_assignments ?? []).map((assignment) =>
            ["assigned", "rejected"].includes(assignment.status) ? (
              <button
                key={assignment.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSubmitAssignment(assignment);
                }}
                className="acm-btn acm-btn-primary h-9 px-3 text-xs"
              >
                {assignment.status === "rejected"
                  ? "Resubmit"
                  : "Submit"}
              </button>
            ) : null
          )}

          {task.can_approve
            ? (task.assignments ?? [])
                .filter(
                  (assignment) => assignment.status === "submitted"
                )
                .map((assignment) => (
                  <button
                    key={`review-${assignment.id}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReviewAssignment(assignment);
                    }}
                    className="acm-btn acm-btn-primary h-9 px-3 text-xs"
                  >
                    Review
                  </button>
                ))
            : null}
        </div>
      </div>
    </div>
  );
}

function FilePreviewCard({ file, index }) {
  const isImage = file.type?.startsWith("image/");
  const fileName = file.name || `File ${index + 1}`;

  return (
    <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-[color:var(--acm-fg)]">{fileName}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
            {file.type || "File"}{file.size ? ` | ${Math.round(file.size / 1024)} KB` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={file.dataUrl} target="_blank" rel="noreferrer" className="acm-btn acm-btn-secondary h-9 px-3 text-xs">
            Preview
          </a>
          <a href={file.dataUrl} download={fileName} className="acm-btn acm-btn-primary h-9 px-3 text-xs">
            Download
          </a>
        </div>
      </div>
      {isImage ? (
        <Image src={file.dataUrl} alt={fileName} width={960} height={480} className="mt-4 max-h-56 w-full rounded-[16px] object-cover" unoptimized />
      ) : null}
    </div>
  );
}

export function TaskReviewPanel({
  task,
  assignment,
  files,
  formatDate,
  formatDateTime,
  approvalRoleLabel,
}) {
  if (!task || !assignment) return null;

  const submission = assignment.latest_submission;
  const assigneeName = assignment.assignee?.name || assignment.assignee?.user_code || "Assignee";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <section className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-[color:var(--acm-fg)]">{task.title ?? "-"}</h3>
            <StatusBadge status={assignment.status} />
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[color:var(--acm-fg)] md:grid-cols-2">
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Project:</span> {task.project?.name ?? "-"}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Approval Type:</span> {approvalRoleLabel}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Assignee:</span> {assigneeName}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Approver:</span> {task.approver?.name ?? task.approver?.user_code ?? "-"}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Start Date:</span> {formatDate(task.start_date)}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">End Date:</span> {formatDate(task.end_date)}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Assigned At:</span> {formatDateTime(assignment.created_at)}</div>
            <div><span className="font-semibold text-[color:var(--acm-muted-fg)]">Submitted At:</span> {formatDateTime(submission?.created_at)}</div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Description</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--acm-fg)]">{task.description ?? "-"}</div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Assigned Users</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(task.assignments ?? []).map((item) => (
                <div key={item.id} className="rounded-full border border-[color:var(--acm-border)] px-3 py-1.5 text-sm text-[color:var(--acm-fg)]">
                  {(item.assignee?.name || item.assignee?.user_code || "User")} ({item.role})
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
          <div className="text-lg font-bold text-[color:var(--acm-fg)]">Submission Details</div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Work Description</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--acm-fg)]">{submission?.work_description ?? "-"}</div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Blocker</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--acm-fg)]">{submission?.blocker ?? "-"}</div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Latest Remark</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--acm-fg)]">{assignment.latest_approval?.comment ?? "-"}</div>
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
        <div className="text-lg font-bold text-[color:var(--acm-fg)]">Uploaded Files</div>
        <div className="mt-4 space-y-3">
          {files.length ? files.map((file, index) => <FilePreviewCard key={`${file.name}-${index}`} file={file} index={index} />) : (
            <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-8 text-sm text-[color:var(--acm-muted-fg)]">
              No files uploaded for this assignment yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
