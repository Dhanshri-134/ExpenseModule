"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton, CompactListRow, DrilldownModal, StatusMetricButton } from "@/components/dashboard/DashboardUi";
import { ProjectEstimatesPage, ProjectFieldReportsPage } from "@/components/dashboard/Project/ProjectOperationsPanels";
import { TasksManagerPage as TaskModulePage } from "@/components/dashboard/task/TasksManagerPage";
import PasswordInput from "@/components/shared/PasswordInput";
import {
  InsightsIcon,
  ProjectsIcon,
  PulseIcon,
  TeamIcon,
} from "@/components/dashboard/icons";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";
import { Pencil, Plus, Trash2 } from "lucide-react";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 ${extra}`.trim();
}

function fieldClass() {
  return "acm-input mt-0";
}

function roleName(role) {
  if (!role) return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatCompactNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";

  const absoluteValue = Math.abs(numericValue);
  const format = (divisor, suffix) => {
    const scaledValue = numericValue / divisor;
    const digits = Math.abs(scaledValue) >= 100 ? 0 : Math.abs(scaledValue) >= 10 ? 1 : 2;
    const roundedValue = Number(scaledValue.toFixed(digits));
    return `${roundedValue}${suffix}`;
  };

  if (absoluteValue >= 1_000_000_000) return format(1_000_000_000, "B");
  if (absoluteValue >= 10_000_000) return format(10_000_000, "Cr");
  if (absoluteValue >= 1_000_000) return format(1_000_000, "M");
  if (absoluteValue >= 100_000) return format(100_000, "L");
  if (absoluteValue >= 1_000) return format(1_000, "K");

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numericValue);
}

function MetricChip({ label, value, icon: Icon, onClick, tone }) {
  if (onClick) {
    return <StatusMetricButton label={label} value={value} onClick={onClick} tone={tone} />;
  }

  return (
    <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-3 py-3 text-left">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[color:var(--acm-fg)]">
        {Icon ? <Icon className="h-4 w-4 text-[color:var(--acm-accent)]" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}

function OverviewStatButton({ label, value, onClick, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-[color:var(--acm-accent-border)] bg-[color:var(--acm-hover)]"
          : "border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-3 py-2 text-left transition hover:border-[color:var(--acm-accent-border)] hover:bg-[color:var(--acm-surface)] ${toneClass}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold tracking-tight text-[color:var(--acm-fg)]">{value}</div>
    </button>
  );
}

function OverviewCard({
  title,
  value,
  accent,
  icon: Icon,
  onOpen,
  openLabel = "Open",
  stats = [],
  layout = "grid",
}) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4 ">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-75"
        style={{ background: accent }}
      />
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 border-l border-b border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)] opacity-80" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
              {title}
            </div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-3xl font-black tracking-[-0.05em] text-[color:var(--acm-fg)]">
                {value}
              </div>
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center rounded-full border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-fg)] transition hover:border-[color:var(--acm-accent-border)] hover:bg-[color:var(--acm-surface-2)]"
              >
                {openLabel}
              </button>
            </div>
          </div>
          <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)]/95 p-2.5 text-[color:var(--acm-accent)] backdrop-blur">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className={layout === "stack" ? "mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2" : "mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-2"}>
          {stats.map((stat) => (
            <OverviewStatButton
              key={stat.key || stat.label}
              label={stat.label}
              value={stat.value}
              onClick={stat.onClick}
              tone={stat.tone}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

function getProjectErrorMessage(error) {
  if (!error) return "";
  if (error === "forbidden") return "You do not have access to this project.";
  if (error === "invalid_project_id") return "This project link is invalid.";
  if (error === "unauthenticated") return "Your session has expired. Please sign in again.";
  if (error === "project_not_found") return "Project not found.";
  return "Unable to load this project right now.";
}

function getProjectDefaultId(projects) {
  return projects?.[0]?.id || "";
}

function getStaffOptionLabel(item) {
  if (!item) return "";
  const primary = item.name || item.user_name || item.user_code || "User";
  return item.user_code && item.user_code !== primary ? `${primary} (${item.user_code})` : primary;
}

function getProjectNames(item, projectId = "") {
  const assignments = item?.project_assignments ?? [];
  const scopedAssignments = projectId
    ? assignments.filter((assignment) => assignment.project_id === projectId)
    : assignments;
  return [...new Set(scopedAssignments.map((assignment) => assignment.project?.name).filter(Boolean))];
}

function getProjectAssignmentSummary(item, projectId = "") {
  const names = getProjectNames(item, projectId);
  if (names.length) return names.join(", ");
  return item?.created_project?.name || "-";
}

function getTaskAssigneeLabel(item, projectId = "") {
  const projectSummary = getProjectAssignmentSummary(item, projectId);
  return `${getStaffOptionLabel(item)} | ${roleName(item.role)} | ${projectSummary}`;
}

function getTaskStatusGroups(roleBase, taskGroups, taskSummary) {
  if (roleBase === "owner") {
    const today = new Date().toDateString();
    return [
      {
        key: "todayAssigned",
        label: "Today's Assigned",
        value: taskSummary.todayAssigned ?? 0,
        items: (taskGroups.tasks ?? []).filter((task) =>
          (task.assignments ?? []).some((assignment) => new Date(assignment.created_at).toDateString() === today)
        ),
      },
      {
        key: "completed",
        label: "Completed",
        value: taskSummary.completed ?? 0,
        items: (taskGroups.tasks ?? []).filter((task) =>
          (task.assignments ?? []).some((assignment) => assignment.status === "approved")
        ),
      },
    ];
  }

  return [
    {
      key: "myCompleted",
      label: "My Tasks Completed",
      value: taskSummary.myTasks?.completed ?? 0,
      items: (taskGroups.assignedTasks ?? []).filter((task) =>
        (task.my_assignments ?? []).some((assignment) => assignment.status === "approved")
      ),
    },
    {
      key: "approved",
      label: "Approved",
      value: taskSummary.approvingTasks?.approved ?? 0,
      items: taskGroups.approvedByMe ?? [],
    },
    {
      key: "toApprove",
      label: "To Be Approved",
      value: taskSummary.approvingTasks?.toBeApproved ?? 0,
      items: (taskGroups.tasks ?? []).filter((task) =>
        (task.assignments ?? []).some((assignment) => assignment.status === "submitted")
      ),
    },
    ...(roleBase === "manager"
      ? [
          {
            key: "assigned",
            label: "Assigned",
            value: taskSummary.assignedTasks?.assigned ?? 0,
            items: (taskGroups.tasks ?? []).filter((task) =>
              (task.assignments ?? []).some((assignment) => assignment.assigned_by_user_id === task.creator?.user_id)
            ),
          },
          {
            key: "assignedCompleted",
            label: "Assigned Completed",
            value: taskSummary.assignedTasks?.completed ?? 0,
            items: (taskGroups.tasks ?? []).filter((task) =>
              (task.assignments ?? []).some((assignment) => assignment.status === "approved")
            ),
          },
        ]
      : []),
  ];
}

function getApproverOptions(staffData, projectId, role) {
  const source = role === "manager" ? staffData.managers ?? [] : staffData.employees ?? [];
  return source.filter((item) => {
    if (!projectId) return true;
    return (item.project_assignments ?? []).some((assignment) => assignment.project_id === projectId);
  });
}

function LabeledField({ label, children }) {
  return (
    <label className="relative block pt-3">
      <span className="acm-field-label">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldGroup({ title, children }) {
  return (
    <fieldset className="rounded-[20px] border border-[color:var(--acm-border)] p-4">
      <legend className="acm-fieldset-legend">{title}</legend>
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );
}

function useApi(url) {
  return useApiQuery(url);
}

function InlineMessage({ error, message, onDismiss }) {
  if (error) {
    return (
      <div className="flex items-start justify-between gap-3 acm-message-error">
        <span>{error}</span>
        {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
        <div className="flex items-start justify-between gap-3">
          <span>{message}</span>
          {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
        </div>
      </div>
    );
  }

  return null;
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function ProfileModal({ open, title, details, onClose, onSendEmail, actions }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-2">
        {details.map((detail) => (
          <DetailRow key={`${detail.label}-${detail.value}`} label={detail.label} value={detail.value} />
        ))}
      </div>
      {onSendEmail || actions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onSendEmail ? (
            <button type="button" onClick={onSendEmail} className="acm-btn acm-btn-primary h-10 px-4">
              Send Email
            </button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </Modal>
  );
}

async function sendCredentialEmail(userId) {
  const res = await fetch("/api/send-credentials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json().catch(() => null);
  // if (!res.ok) throw new Error(json?.error || "send_credentials_failed");
  if (json?.delivery?.mailto) {
    window.location.href = json.delivery.mailto;
  }
  return json;
}

function AssignmentPill({ assignment }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--acm-border)] px-3 py-2 text-sm">
      <div className="font-semibold">{assignment.assignee?.name || assignment.assignee?.user_code || "Assignee"}</div>
      <div className="text-[color:var(--acm-muted-fg)]">
        {assignment.assignee?.user_code || assignment.role} | {assignment.status}
      </div>
      {assignment.latest_approval?.approved_by ? (
        <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">
          Approved By: {assignment.latest_approval.approved_by.name || assignment.latest_approval.approved_by.user_code} ({assignment.latest_approval.approved_by_role})
        </div>
      ) : null}
      {assignment.latest_approval?.comment ? (
        <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">Review: {assignment.latest_approval.comment}</div>
      ) : null}
    </div>
  );
}

function UpdatesCard({ logs }) {
  return (
    <div className={cardClass()}>
      <SectionHeader title="Recent Updates" />
      <div className="space-y-3">
        {(logs ?? []).length ? (
          logs.map((log) => (
            <div key={log.id} className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
              <div className="font-semibold">{log.message}</div>
              <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
                {log.actor?.name || log.actor?.user_code || "System"} | {formatDate(log.created_at)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-[color:var(--acm-muted-fg)]">No updates yet.</div>
        )}
      </div>
    </div>
  );
}

export function DashboardOverview({ roleBase, canManageStaff = false }) {
  const router = useRouter();
  const dashboard = useApi("/api/dashboard");
  const projects = useApi("/api/projects");
  const staff = useApi("/api/staff");
  const tasks = useApi("/api/tasks");
  const [drilldown, setDrilldown] = useState({ open: false, title: "", items: [], type: "" });
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const summary = dashboard.data?.summary;
  const projectList = projects.data?.projects ?? [];
  const managers = staff.data?.staff?.managers ?? [];
  const employees = staff.data?.staff?.employees ?? [];
  const staffList = [
    ...(canManageStaff ? managers : []),
    ...employees,
  ];
  const taskGroups = tasks.data ?? { tasks: [], assignedTasks: [], approvedByMe: [] };
  const taskList = taskGroups.tasks ?? [];
  const taskSummary = summary?.tasks ?? {};
  const projectStatusGroups = [
    {
      label: "Live",
      value: summary?.projects?.live ?? 0,
      items: projectList.filter((project) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = project.start_date ? new Date(project.start_date) : null;
        const end = project.end_date ? new Date(project.end_date) : null;
        return (!start || start <= today) && (!end || end >= today);
      }),
      tone: "success",
    },
    {
      label: "Complete",
      value: summary?.projects?.complete ?? 0,
      items: projectList.filter((project) => {
        const end = project.end_date ? new Date(project.end_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Boolean(end && end < today);
      }),
      tone: "default",
    },
    {
      label: "On Hold",
      value: summary?.projects?.onhold ?? 0,
      items: projectList.filter((project) => {
        const start = project.start_date ? new Date(project.start_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Boolean(start && start > today);
      }),
      tone: "default",
    },
  ];
  const staffGroups = [
    { label: "Managers", value: summary?.staff?.managers ?? 0, items: managers, tone: "default" },
    { label: "Employees", value: summary?.staff?.employees ?? 0, items: employees, tone: "default" },
  ];
  const taskGroupsForOverview = getTaskStatusGroups(roleBase, taskGroups, taskSummary);

  function openDrilldown(title, items, type) {
    setDrilldown({ open: true, title, items, type });
  }

  return (
    <>
      {/* <SectionHeader title="Overview" /> */}

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr_1.15fr]">
        <OverviewCard
          title="Projects"
          value={formatCompactNumber(summary?.projects?.total ?? 0)}
          icon={ProjectsIcon}
          accent="linear-gradient(135deg, color-mix(in srgb, var(--acm-accent) 22%, transparent), transparent 70%)"
          onOpen={() => router.push(`/${roleBase}/projects`)}
          openLabel="Open Projects"
          stats={projectStatusGroups.map((group) => ({
            key: group.label,
            label: group.label,
            value: formatCompactNumber(group.value),
            onClick: () => openDrilldown(`${group.label} Projects`, group.items, "project"),
            tone: group.tone,
          }))}
        />

        <OverviewCard
          title="Staff"
          value={formatCompactNumber(staffList.length)}
          icon={TeamIcon}
          accent="linear-gradient(135deg, color-mix(in srgb, var(--acm-accent) 14%, transparent), transparent 72%)"
          onOpen={() => openDrilldown("All Staff", staffList, "staff")}
          openLabel="Open Staff"
          stats={staffGroups.map((group) => ({
            key: group.label,
            label: group.label,
            value: formatCompactNumber(group.value),
            onClick: () => openDrilldown(group.label, group.items, "staff"),
            tone: group.tone,
          }))}
        />

        <OverviewCard
          title="Tasks"
          value={formatCompactNumber(roleBase === "owner" ? taskSummary.todayAssigned ?? 0 : taskSummary.myTasks?.total ?? 0)}
          icon={PulseIcon}
          accent="linear-gradient(135deg, color-mix(in srgb, var(--acm-accent) 18%, transparent), color-mix(in srgb, var(--acm-surface-2) 55%, transparent) 52%, transparent 85%)"
          onOpen={() => router.push(`/${roleBase}/tasks`)}
          openLabel="Open Tasks"
          layout="stack"
          stats={taskGroupsForOverview.map((group, index) => ({
            key: group.key,
            label: group.label,
            value: formatCompactNumber(group.value),
            onClick: () => openDrilldown(group.label, group.items, "task"),
            tone: index === 0 ? "success" : "default",
          }))}
        />
      </section>

      {/* <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className={cardClass()}>
          <SectionHeader title="Projects" action={<Link href={`/${roleBase}/projects`} className="text-sm font-semibold text-[color:var(--acm-accent)]">Open</Link>} />
          <div className="space-y-3">
            {projectList.slice(0, 3).map((project) => (
              <CompactListRow
                key={project.id}
                primary={project.name}
                secondary={project.job_number}
                tertiary={`${project.client?.name || "-"} | ${project.location || "-"}`}
                onClick={() => setSelectedProject(project)}
              />
            ))}
          </div>
        </div>
        <div className={cardClass()}>
          <SectionHeader title="Tasks" action={<Link href={`/${roleBase}/tasks`} className="text-sm font-semibold text-[color:var(--acm-accent)]">Open</Link>} />
          <div className="space-y-3">
            {taskList.slice(0, 3).map((task) => (
              <CompactListRow
                key={task.id}
                primary={task.title}
                secondary={task.project?.name || "-"}
                tertiary={`${formatDate(task.start_date)} to ${formatDate(task.end_date)}`}
                onClick={() => setSelectedTask(task)}
              />
            ))}
          </div>
        </div>
      </section> */}

      <DrilldownModal
        open={drilldown.open}
        title={drilldown.title}
        items={drilldown.items}
        emptyMessage="No matching records yet."
        onClose={() => setDrilldown({ open: false, title: "", items: [], type: "" })}
        renderItem={(item) => {
          if (drilldown.type === "project") {
            return (
              <CompactListRow
                key={item.id}
                primary={item.name}
                secondary={item.job_number}
                tertiary={`${item.client?.name || "-"} | ${item.location || "-"}`}
                onClick={() => {
                  setDrilldown({ open: false, title: "", items: [], type: "" });
                  setSelectedProject(item);
                }}
              />
            );
          }

          if (drilldown.type === "task") {
            return (
              <CompactListRow
                key={item.id}
                primary={item.title}
                secondary={item.project?.name || "-"}
                tertiary={`${formatDate(item.start_date)} to ${formatDate(item.end_date)} | ${item.approval_role || "-"}`}
                onClick={() => {
                  setDrilldown({ open: false, title: "", items: [], type: "" });
                  setSelectedTask(item);
                }}
              />
            );
          }

          return (
            <CompactListRow
              key={item.user_id}
              primary={item.name || item.user_name || item.user_code}
              secondary={`${item.user_name || item.user_code} | ${item.user_code}`}
              tertiary={`${roleName(item.role)} | ${getProjectAssignmentSummary(item)}`}
              onClick={() => {
                setDrilldown({ open: false, title: "", items: [], type: "" });
                setSelectedStaff(item);
              }}
            />
          );
        }}
      />

      <ProfileModal
        open={Boolean(selectedProject)}
        title="Project Profile"
        details={
          selectedProject
            ? [
                { label: "Job Number", value: selectedProject.job_number },
                { label: "Project", value: selectedProject.name },
                { label: "Client", value: selectedProject.client?.name || "-" },
                { label: "Location", value: selectedProject.location || "-" },
                { label: "Start Date", value: formatDate(selectedProject.start_date) },
                { label: "End Date", value: formatDate(selectedProject.end_date) },
                { label: "Estimate Budget", value: `$${selectedProject.contract_value}` },
              ]
            : []
        }
        onClose={() => setSelectedProject(null)}
        actions={
          selectedProject ? (
            <button
              type="button"
              onClick={() => {
                setSelectedProject(null);
                router.push(`/${roleBase}/project/${selectedProject.id}/overview`);
              }}
              className="acm-btn acm-btn-primary h-10 px-4"
            >
              Go to Project Dashboard
            </button>
          ) : null
        }
      />

      <ProfileModal
        open={Boolean(selectedStaff)}
        title="User Profile"
        details={
          selectedStaff
            ? [
                { label: "User Code", value: selectedStaff.user_code },
                { label: "User Name", value: selectedStaff.user_name || selectedStaff.user_code },
                { label: "Name", value: selectedStaff.name },
                { label: "Email", value: selectedStaff.email },
                { label: "Mobile", value: selectedStaff.mobile },
                { label: "Role", value: roleName(selectedStaff.role) },
                { label: "Projects", value: getProjectAssignmentSummary(selectedStaff) },
              ]
            : []
        }
        onClose={() => setSelectedStaff(null)}
        actions={
          <button
            type="button"
            onClick={() => {
              setSelectedStaff(null);
              router.push(`/${roleBase}${roleBase === "owner" ? "/staff" : "/projects"}`);
            }}
            className="acm-btn acm-btn-primary h-10 px-4"
          >
            {roleBase === "owner" ? "Open Staff Directory" : "Open Projects"}
          </button>
        }
      />

      <ProfileModal
        open={Boolean(selectedTask)}
        title="Task Profile"
        details={selectedTask ? buildTaskDetails(selectedTask) : []}
        onClose={() => setSelectedTask(null)}
        actions={
          <button
            type="button"
            onClick={() => {
              setSelectedTask(null);
              router.push(`/${roleBase}/tasks`);
            }}
            className="acm-btn acm-btn-primary h-10 px-4"
          >
            Open Task Board
          </button>
        }
      />
    </>
  );
}

export function ProjectsManagerPage({ roleBase, canCreateProject = false }) {
  const router = useRouter();
  const projects = useApi("/api/projects");
  const clients = useApi("/api/clients");
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileProject, setProfileProject] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [form, setForm] = useState({
    id: "",
    name: "",
    location: "",
    clientMode: "existing",
    clientId: "",
    clientName: "",
    clientContact: "",
    clientEmail: "",
    clientAddress: "",
    startDate: "",
    endDate: "",
    contractValue: "",
  });

  const projectList = projects.data?.projects ?? [];
  const filterClientId = typeof router.query.clientId === "string" ? router.query.clientId : "";
  const filteredClient = (clients.data?.clients ?? []).find((client) => client.id === filterClientId) || null;
  const visibleProjects = filterClientId
    ? projectList.filter((project) => project.client_id === filterClientId)
    : projectList;

  function openCreate() {
    setEditingProject(null);
    setForm({
      id: "",
      name: "",
      location: "",
      clientMode: filteredClient ? "existing" : "new",
      clientId: filteredClient?.id || "",
      clientName: filteredClient?.name || "",
      clientContact: filteredClient?.contact || "",
      clientEmail: filteredClient?.email || "",
      clientAddress: filteredClient?.address || "",
      startDate: "",
      endDate: "",
      contractValue: "",
    });
    setOpen(true);
  }

  function openEdit(project) {
    setEditingProject(project);
    setForm({
      id: project.id,
      name: project.name || "",
      location: project.location || "",
      clientMode: "existing",
      clientId: project.client?.id || "",
      clientName: project.client?.name || "",
      clientContact: project.client?.contact || "",
      clientEmail: project.client?.email || "",
      clientAddress: project.client?.address || "",
      startDate: project.start_date || "",
      endDate: project.end_date || "",
      contractValue: project.contract_value || "",
    });
    setOpen(true);
  }

  async function saveProject(e) {
    e.preventDefault();
    if (formBusy) return;
    setError("");
    setMessage("");
    setFormBusy(true);

    const res = await fetch(editingProject ? "/api/project" : "/api/projects", {
      method: editingProject ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        clientId: form.clientMode === "existing" ? form.clientId || null : null,
        clientName: form.clientMode === "new" ? form.clientName : null,
        clientContact: form.clientMode === "new" ? form.clientContact : null,
        clientEmail: form.clientMode === "new" ? form.clientEmail : null,
        clientAddress: form.clientMode === "new" ? form.clientAddress : null,
        contractValue: Number(form.contractValue || 0),
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "project_save_failed");
    //   setFormBusy(false);
    //   return;
    // }

    setMessage(editingProject ? "Project updated" : `Created ${json.project.job_number}`);
    if (editingProject) {
      setOpen(false);
    }
    invalidateApiQuery("/api/dashboard");
    await projects.refresh();
    setFormBusy(false);
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete project ${project.name}?`)) return;
    if (deletingProjectId) return;
    setError("");
    setMessage("");
    setDeletingProjectId(project.id);
    const res = await fetch("/api/project", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: project.id }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "project_delete_failed");
    //   setDeletingProjectId("");
    //   return;
    // }
    setMessage(`${project.name} deleted`);
    invalidateApiQuery("/api/dashboard");
    await projects.refresh();
    setDeletingProjectId("");
  }

  return (
    <>
      <SectionHeader
        title={filteredClient ? `${filteredClient.name} Projects` : "Projects"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {filteredClient ? (
              <button
                type="button"
                onClick={() => router.push(`/${roleBase}/clients`)}
                className="acm-btn acm-btn-secondary h-10 px-4"
              >
                Back to Clients
              </button>
            ) : null}
            {canCreateProject ? (
              <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
                Create Project
              </button>
            ) : null}
          </div>
        }
      />

      <InlineMessage error={projects.error || error} message={message} />

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleProjects.map((project) => (
          <CompactListRow
            key={project.id}
            primary={project.name}
            secondary={`${project.job_number} | ${project.client?.name || "-"}`}
            tertiary={`${project.location || "-"} | ${formatDate(project.start_date)} to ${formatDate(project.end_date)}`}
            onClick={() => setProfileProject(project)}
            actions={
              <div className="flex flex-wrap gap-2">
                <Link href={`/${roleBase}/project/${project.id}/overview`} className="acm-btn acm-btn-primary h-9 px-3 text-xs">
                  Open
                </Link>
                {/* {canCreateProject ? (
                  <>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openEdit(project); }} className="acm-btn acm-btn-secondary h-9 px-3 text-xs">
                      Edit
                    </button>
                    <BusyButton
                      type="button"
                      busy={deletingProjectId === project.id}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteProject(project);
                      }}
                    >
                      Delete
                    </BusyButton>
                  </>
                ) : null} */}
              </div>
            }
          />
        ))}
      </section>

      <ProfileModal
        open={Boolean(profileProject)}
        title="Project Profile"
        details={
          profileProject
            ? [
                { label: "Job Number", value: profileProject.job_number },
                { label: "Project", value: profileProject.name },
                { label: "Client", value: profileProject.client?.name || "-" },
                { label: "Client Contact", value: profileProject.client?.contact || "-" },
                { label: "Client Email", value: profileProject.client?.email || "-" },
                { label: "Client Address", value: profileProject.client?.address || "-" },
                { label: "Location", value: profileProject.location || "-" },
                { label: "Start Date", value: formatDate(profileProject.start_date) },
                { label: "End Date", value: formatDate(profileProject.end_date) },
                { label: "Estimate Budget", value: `$${profileProject.contract_value}` },
              ]
            : []
        }
        onClose={() => setProfileProject(null)}
        actions={
          profileProject ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setProfileProject(null);
                  router.push(`/${roleBase}/project/${profileProject.id}/overview`);
                }}
                className="acm-btn acm-btn-primary h-10 px-4"
              >
                Go to Project Dashboard
              </button>
              {canCreateProject ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileProject(null);
                      openEdit(profileProject);
                    }}
                    className="acm-btn acm-btn-secondary h-10 px-4"
                  >
                    Edit
                  </button>
                  <BusyButton
                    type="button"
                    busy={deletingProjectId === profileProject.id}
                    className="acm-btn acm-btn-secondary h-10 px-4"
                    onClick={() => {
                      setProfileProject(null);
                      deleteProject(profileProject);
                    }}
                  >
                    Delete
                  </BusyButton>
                </>
              ) : null}
            </>
          ) : null
        }
      />

      <Modal open={open} title={editingProject ? "Edit Project" : "Create Project"} onClose={() => setOpen(false)}>
        <form onSubmit={saveProject} className="grid gap-3">
          <InlineMessage error={error} message={message} />

          <fieldset disabled={Boolean(message && !editingProject && !error)} className="contents">
            <FieldGroup title="Client Info">
              <LabeledField label="Client Source">
                <select
                  className={fieldClass()}
                  value={form.clientMode}
                  disabled={Boolean(filteredClient && !editingProject)}
                  onChange={(e) => setForm((prev) => ({ ...prev, clientMode: e.target.value }))}
                >
                  <option value="existing">Use Existing Client</option>
                  <option value="new">Create New Client</option>
                </select>
              </LabeledField>
              {form.clientMode === "existing" ? (
                <LabeledField label="Client">
                  <select
                    className={fieldClass()}
                    value={form.clientId}
                    disabled={Boolean(filteredClient && !editingProject)}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="">Select client</option>
                    {(clients.data?.clients ?? []).map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </LabeledField>
              ) : (
                <>
                  <LabeledField label="Client Name">
                    <input className={fieldClass()} value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} />
                  </LabeledField>
                  <LabeledField label="Client Contact">
                    <input className={fieldClass()} value={form.clientContact} onChange={(e) => setForm((prev) => ({ ...prev, clientContact: e.target.value }))} />
                  </LabeledField>
                  <LabeledField label="Client Email">
                    <input className={fieldClass()} type="email" value={form.clientEmail} onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))} />
                  </LabeledField>
                  <LabeledField label="Client Address">
                    <textarea className={fieldClass()} rows={3} value={form.clientAddress} onChange={(e) => setForm((prev) => ({ ...prev, clientAddress: e.target.value }))} />
                  </LabeledField>
                </>
              )}
            </FieldGroup>

            <FieldGroup title="Project Info">
              <LabeledField label="Project Name">
                <input className={fieldClass()} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Location">
                <input className={fieldClass()} value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Start Date">
                <input className={fieldClass()} type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="End Date">
                <input className={fieldClass()} type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Estimate Budget">
                <input className={fieldClass()} inputMode="decimal" value={form.contractValue} onChange={(e) => setForm((prev) => ({ ...prev, contractValue: e.target.value }))} />
              </LabeledField>
            </FieldGroup>

            {!(message && !editingProject && !error) && (
              <BusyButton type="submit" busy={formBusy} className="acm-btn acm-btn-primary">
                Save
              </BusyButton>
            )}
          </fieldset>
        </form>
      </Modal>
    </>
  );
}

export function LeadsManagerPage({ roleBase = "owner", canCreateLead = false }) {
  const router = useRouter();
  const leads = useApi("/api/leads");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [convertBusyId, setConvertBusyId] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [leadEditForm, setLeadEditForm] = useState({ name: "", address: "", contact: "", email: "" });
  const [leadEditBusy, setLeadEditBusy] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpFormOpen, setFollowUpFormOpen] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState("");
  const [deletingFollowUpId, setDeletingFollowUpId] = useState("");
  const [followUpForm, setFollowUpForm] = useState({
    note: "",
    nextFollowUpDate: "",
    status: "pending",
  });
  const followUps = useApiQuery(
    selectedLead ? `/api/lead-followups?leadId=${selectedLead.id}` : "",
    { enabled: Boolean(selectedLead) }
  );

  const [form, setForm] = useState({
    name: "",
    address: "",
    contact: "",
    email: "",
    followUpDate: "",
    followUpNote: "",
    followUpStatus: "pending",
  });

  const leadList = (leads.data?.leads ?? []).filter((lead) => lead.status !== "converted");

  function openCreate() {
    setForm({
      name: "",
      address: "",
      contact: "",
      email: "",
      followUpDate: "",
      followUpNote: "",
      followUpStatus: "pending",
    });
    setOpen(true);
  }

  async function saveLead(e) {
    e.preventDefault();
    if (formBusy) return;

    setError("");
    setMessage("");
    setFormBusy(true);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setError(json?.error || "lead_create_failed");
    //   setFormBusy(false);
    //   return;
    // }

    setOpen(false);
    setMessage("Lead created");
    invalidateApiQuery("/api/leads");
    invalidateApiQuery("/api/dashboard");
    await leads.refresh();
    setFormBusy(false);
  }

  function openLeadEdit() {
    if (!selectedLead) return;
    setLeadEditForm({
      name: selectedLead.name || "",
      address: selectedLead.address || "",
      contact: selectedLead.contact || "",
      email: selectedLead.email || "",
    });
    setLeadEditOpen(true);
    setFollowUpFormOpen(false);
    setFollowUpMessage("");
    setFollowUpError("");
  }

  async function saveLeadEdit(e) {
    e.preventDefault();
    if (!selectedLead || leadEditBusy) return;

    setLeadEditBusy(true);
    setFollowUpMessage("");
    setFollowUpError("");

    const res = await fetch("/api/leads", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selectedLead.id, ...leadEditForm }),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setFollowUpError(json?.error || "lead_update_failed");
    //   setLeadEditBusy(false);
    //   return;
    // }

    const updatedLead = { ...selectedLead, ...(json?.lead || leadEditForm) };
    setSelectedLead(updatedLead);
    setLeadEditOpen(false);
    setFollowUpMessage("Lead updated");
    invalidateApiQuery("/api/leads");
    await leads.refresh();
    setLeadEditBusy(false);
  }

  async function convertLead(lead) {
    if (lead.status === "converted" || convertBusyId) return;
    setError("");
    setMessage("");
    setConvertBusyId(lead.id);

    const res = await fetch("/api/lead", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: lead.id }),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setError(json?.error || "lead_convert_failed");
    //   setConvertBusyId("");
    //   return;
    // }

    setMessage("Lead converted to client");
    invalidateApiQuery("/api/clients");
    invalidateApiQuery("/api/leads");
    await leads.refresh();
    setConvertBusyId("");
  }

  async function saveFollowUp(e) {
    e.preventDefault();
    if (!selectedLead || followUpBusy) return;

    setFollowUpMessage("");
    setFollowUpError("");
    setFollowUpBusy(true);

    const res = await fetch("/api/lead-followups", {
      method: editingFollowUpId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editingFollowUpId || undefined,
        leadId: selectedLead.id,
        note: followUpForm.note,
        nextFollowUpDate: followUpForm.nextFollowUpDate,
        status: followUpForm.status,
      }),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setFollowUpError(json?.error || "lead_followup_create_failed");
    //   setFollowUpBusy(false);
    //   return;
    // }

    setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
    setEditingFollowUpId("");
    setFollowUpFormOpen(false);
    setFollowUpMessage(editingFollowUpId ? "Follow-up updated" : "Follow-up saved");
    invalidateApiQuery("/api/leads");
    await Promise.all([followUps.refresh(), leads.refresh()]);
    setFollowUpBusy(false);
  }

  function openFollowUpForm(item = null) {
    setLeadEditOpen(false);
    setFollowUpFormOpen(true);
    setEditingFollowUpId(item?.id || "");
    setFollowUpForm({
      note: item?.note || "",
      nextFollowUpDate: item?.next_follow_up_date || item?.date || "",
      status: item?.status || "pending",
    });
    setFollowUpMessage("");
    setFollowUpError("");
  }

  async function deleteLeadFollowUp(item) {
    if (!item || deletingFollowUpId) return;
    if (!window.confirm("Delete this follow-up?")) return;

    setDeletingFollowUpId(item.id);
    setFollowUpMessage("");
    setFollowUpError("");

    const res = await fetch("/api/lead-followups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setFollowUpError(json?.error || "lead_followup_delete_failed");
    //   setDeletingFollowUpId("");
    //   return;
    // }

    setFollowUpMessage("Follow-up deleted");
    invalidateApiQuery("/api/leads");
    await Promise.all([followUps.refresh(), leads.refresh()]);
    setDeletingFollowUpId("");
  }

  return (
    <>
      <SectionHeader
        action={
          canCreateLead ? (
            <div className="mb-4">
        <button type="button" onClick={() => router.push(`/${roleBase}/followups`)} className="acm-btn acm-btn-secondary h-10 px-4 mr-2">
          Open Follow-up List
        </button>
            <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
              Create Lead
            </button>
      </div>
          ) : <div className="mb-4">
        <button type="button" onClick={() => router.push(`/${roleBase}/followups`)} className="acm-btn acm-btn-secondary h-10 px-4">
          Open Follow-up List
        </button>
      </div>
          
        }
      />

      <InlineMessage error={leads.error || error} message={message} />

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {leadList.map((lead) => (
          <CompactListRow
            key={lead.id}
            primary={lead.name}
            secondary={lead.status === "converted" ? "Converted Lead" : "Enquiry Lead"}
            tertiary={
  <>
    {lead.contact}
    <br />
    {lead.email}
    <br />
    Next follow-up: {formatDate(lead.nextFollowUpDate)}
  </>
}
            onClick={() => {
              setSelectedLead(lead);
              setLeadEditOpen(false);
              setFollowUpFormOpen(false);
              setEditingFollowUpId("");
              setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
              setFollowUpMessage("");
              setFollowUpError("");
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                
                <BusyButton
                  type="button"
                  busy={convertBusyId === lead.id}
                  disabled={lead.status === "converted"}
                  className="acm-btn acm-btn-primary h-9 px-3 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    convertLead(lead);
                  }}
                >
                  {lead.status === "converted" ? "Converted" : "Convert to Client"}
                </BusyButton>
              </div>
            }
          />
        ))}
      </section>

      <Modal open={open} title="Create Lead" onClose={() => setOpen(false)}>
        <form onSubmit={saveLead} className="grid gap-3">
          <FieldGroup title="Lead Info">
            <LabeledField label="Client Name">
              <input required className={fieldClass()} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Contact">
              <input className={fieldClass()} value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Email">
              <input type="email" className={fieldClass()} value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Address">
              <textarea className={fieldClass()} rows={3} value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <FieldGroup title="Create Follow-up">
            <div className="grid gap-3 md:grid-cols-2">
              <LabeledField label="Follow-up Date">
                <input className={fieldClass()} type="date" value={form.followUpDate} onChange={(e) => setForm((prev) => ({ ...prev, followUpDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Status">
                <select className={fieldClass()} value={form.followUpStatus} onChange={(e) => setForm((prev) => ({ ...prev, followUpStatus: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </LabeledField>
            </div>
            <LabeledField label="Note">
              <textarea className={fieldClass()} rows={3} value={form.followUpNote} onChange={(e) => setForm((prev) => ({ ...prev, followUpNote: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <BusyButton type="submit" busy={formBusy} className="acm-btn acm-btn-primary">
            Save
          </BusyButton>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedLead)}
        title={selectedLead ? `${selectedLead.name} Follow Ups` : "Follow Ups"}
        onClose={() => {
          setSelectedLead(null);
          setLeadEditOpen(false);
          setFollowUpFormOpen(false);
          setEditingFollowUpId("");
          setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
        }}
      >
        <div className="space-y-3">

          <InlineMessage error={followUps.error || followUpError} message={followUpMessage} />

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openLeadEdit} className="acm-btn acm-btn-secondary h-10 px-4">
              Edit Lead
            </button>
            <button type="button" onClick={() => openFollowUpForm()} className="acm-btn acm-btn-primary h-10 px-4">
              <Plus size={16} />
              Add Follow Up
            </button>
          </div>

          {leadEditOpen ? (
            <form onSubmit={saveLeadEdit} className="grid gap-3 rounded-[20px] border border-[color:var(--acm-border)] p-4">
              <FieldGroup title="Edit Lead">
                <LabeledField label="Client Name">
                  <input required className={fieldClass()} value={leadEditForm.name} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Client Contact">
                  <input className={fieldClass()} value={leadEditForm.contact} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, contact: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Client Email">
                  <input type="email" className={fieldClass()} value={leadEditForm.email} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, email: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Client Address">
                  <textarea className={fieldClass()} rows={3} value={leadEditForm.address} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, address: e.target.value }))} />
                </LabeledField>
              </FieldGroup>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setLeadEditOpen(false)} className="acm-btn acm-btn-secondary h-10 px-4">Cancel</button>
                <BusyButton type="submit" busy={leadEditBusy} className="acm-btn acm-btn-primary h-10 px-4">Save Lead</BusyButton>
              </div>
            </form>
          ) : null}

          {followUpFormOpen ? (
            <form onSubmit={saveFollowUp} className="grid gap-3 rounded-[20px] border border-[color:var(--acm-border)] p-4">
              <LabeledField label="Follow-up Note">
                <textarea required className={fieldClass()} rows={3} value={followUpForm.note} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, note: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Next Follow-up Date">
                <input type="date" className={fieldClass()} value={followUpForm.nextFollowUpDate} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, nextFollowUpDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Status">
                <select className={fieldClass()} value={followUpForm.status} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </LabeledField>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFollowUpFormOpen(false);
                    setEditingFollowUpId("");
                    setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
                  }}
                  className="acm-btn acm-btn-secondary h-10 px-4"
                >
                  Cancel
                </button>
                <BusyButton type="submit" busy={followUpBusy} className="acm-btn acm-btn-primary h-10 px-4">
                  {editingFollowUpId ? "Save Follow Up" : "Add Follow Up"}
                </BusyButton>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            {(followUps.data?.followUps ?? []).map((item) => (
              <div key={item.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                    {formatDateTime(item.created_at)}
                  </div>
                  {item.canModify !== false ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openFollowUpForm(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)] hover:text-[color:var(--acm-accent)]"
                        aria-label="Edit follow-up"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLeadFollowUp(item)}
                        disabled={deletingFollowUpId === item.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        aria-label="Delete follow-up"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-[color:var(--acm-fg)]">{item.note}</div>
                <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
                  Follow-up Date: {formatDate(item.next_follow_up_date)} <br/> Status: {item.status ?? "-"}
                </div>
                <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
                  Created By: {item.createdBy?.name ?? "-"}
                </div>
              </div>
            ))}
            {!followUps.loading && !(followUps.data?.followUps ?? []).length ? (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)]">
                No follow-ups yet.
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ClientsManagerPage({ roleBase, canCreateClient = false }) {
  const router = useRouter();
  const clients = useApi("/api/clients");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    contact: "",
    email: "",
    followUpDate: "",
    followUpNote: "",
    followUpStatus: "pending",
  });

  const clientList = clients.data?.clients ?? [];

  function openCreate() {
    setForm({
      name: "",
      address: "",
      contact: "",
      email: "",
      followUpDate: "",
      followUpNote: "",
      followUpStatus: "pending",
    });
    setOpen(true);
  }

  async function saveClient(e) {
    e.preventDefault();
    if (formBusy) return;

    setError("");
    setMessage("");
    setFormBusy(true);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => null);

    // if (!res.ok) {
    //   setError(json?.error || "client_create_failed");
    //   setFormBusy(false);
    //   return;
    // }

    setOpen(false);
    setMessage("Client created");
    invalidateApiQuery("/api/clients");
    await clients.refresh();
    setFormBusy(false);
  }

  function openClientEdit(client) {
    setSelectedClient(client);
    setForm({
      name: client.name || "",
      address: client.address || "",
      contact: client.contact || "",
      email: client.email || "",
      followUpDate: "",
      followUpNote: "",
      followUpStatus: "pending",
    });
    setEditOpen(true);
  }

  async function updateClient(event) {
    event.preventDefault();
    if (!selectedClient || formBusy) return;

    setError("");
    setMessage("");
    setFormBusy(true);

    const res = await fetch("/api/clients", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selectedClient.id, ...form }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "client_update_failed");
      setFormBusy(false);
      return;
    }

    setSelectedClient(json?.client || { ...selectedClient, ...form });
    setEditOpen(false);
    setMessage("Client updated");
    invalidateApiQuery("/api/clients");
    await clients.refresh();
    setFormBusy(false);
  }

  async function deleteClient(client) {
    if (!client || deleteBusyId) return;
    if (!window.confirm(`Delete ${client.name}?`)) return;

    setDeleteBusyId(client.id);
    setError("");
    setMessage("");

    const res = await fetch("/api/clients", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: client.id }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "client_delete_failed");
      setDeleteBusyId("");
      return;
    }

    if (selectedClient?.id === client.id) setSelectedClient(null);
    setEditOpen(false);
    setMessage("Client deleted");
    invalidateApiQuery("/api/clients");
    await clients.refresh();
    setDeleteBusyId("");
  }

  return (
    <>
      <SectionHeader
        // title="Clients"
        action={
          canCreateClient ? (
            <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
              Create Client
            </button>
          ) : null
        }
      />

      <InlineMessage error={clients.error || error} message={message} onDismiss={() => { setError(""); setMessage(""); }} />

      {/* <div className="mb-4">
        <button type="button" onClick={() => router.push(`/${roleBase}/followups`)} className="acm-btn acm-btn-secondary h-10 px-4">
          Open Follow-up List
        </button>
      </div> */}

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clientList.map((client) => (
          <CompactListRow
            key={client.id}
            primary={client.name}
            secondary={<>{client.contact}</>}
            tertiary={<> {client.email}<br />{client.address} <br/> Projects: {client.projectCount ?? 0}</>}
            onClick={() => setSelectedClient(client)}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openClientEdit(client);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)] transition hover:text-[color:var(--acm-accent)]"
                  aria-label="Edit client"
                >
                  <Pencil size={15} />
                </button>
                <BusyButton
                  type="button"
                  busy={deleteBusyId === client.id}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-rose-600 transition hover:bg-rose-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteClient(client);
                  }}
                >
                  <Trash2 size={15} />
                </BusyButton>
              </div>
            }
          />
        ))}
      </section>

      <Modal open={open} title="Create Client" onClose={() => setOpen(false)}>
        <form onSubmit={saveClient} className="grid gap-3">
          <FieldGroup title="Client Info">
            <LabeledField label="Client Name">
              <input required className={fieldClass()} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Contact">
              <input className={fieldClass()} value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Email">
              <input type="email" className={fieldClass()} value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Address">
              <textarea className={fieldClass()} rows={3} value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <FieldGroup title="Create Follow-up">
            <div className="grid gap-3 md:grid-cols-2">
              <LabeledField label="Follow-up Date">
                <input className={fieldClass()} type="date" value={form.followUpDate} onChange={(e) => setForm((prev) => ({ ...prev, followUpDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Status">
                <select className={fieldClass()} value={form.followUpStatus} onChange={(e) => setForm((prev) => ({ ...prev, followUpStatus: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </LabeledField>
            </div>
            <LabeledField label="Note">
              <textarea className={fieldClass()} rows={3} value={form.followUpNote} onChange={(e) => setForm((prev) => ({ ...prev, followUpNote: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <BusyButton type="submit" busy={formBusy} className="acm-btn acm-btn-primary">
            Save
          </BusyButton>
        </form>
      </Modal>

      <ProfileModal
        open={Boolean(selectedClient)}
        title={selectedClient ? `${selectedClient.name} Client Info` : "Client Info"}
        details={
          selectedClient
            ? [
                { label: "Name", value: selectedClient.name },
                { label: "Contact", value: selectedClient.contact || "-" },
                { label: "Email", value: selectedClient.email || "-" },
                { label: "Address", value: selectedClient.address || "-" },
                { label: "Projects", value: String(selectedClient.projectCount ?? 0) },
              ]
            : []
        }
        onClose={() => setSelectedClient(null)}
        actions={
          selectedClient ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  router.push({
                    pathname: `/${roleBase}/projects`,
                    query: { clientId: selectedClient.id },
                  });
                }}
                className="acm-btn acm-btn-primary h-10 px-4"
              >
                Open Projects
              </button>
              <button
                type="button"
                onClick={() => openClientEdit(selectedClient)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)] transition hover:text-[color:var(--acm-accent)]"
                aria-label="Edit client"
              >
                <Pencil size={16} />
              </button>
              <BusyButton
                type="button"
                busy={deleteBusyId === selectedClient.id}
                onClick={() => deleteClient(selectedClient)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 size={16} />
              </BusyButton>
            </>
          ) : null
        }
      />

      <Modal open={editOpen} title="Edit Client" onClose={() => setEditOpen(false)}>
        <form onSubmit={updateClient} className="grid gap-3">
          <FieldGroup title="Client Info">
            <LabeledField label="Client Name">
              <input required className={fieldClass()} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Contact">
              <input className={fieldClass()} value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Email">
              <input type="email" className={fieldClass()} value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Client Address">
              <textarea className={fieldClass()} rows={3} value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="acm-btn acm-btn-secondary h-10 px-4">Cancel</button>
            <BusyButton type="submit" busy={formBusy} className="acm-btn acm-btn-primary h-10 px-4">Save Client</BusyButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ProjectDashboardView({ projectId, roleBase, ownerMode = false, section = "overview", currentUserId = "" }) {
  const detail = useApi(`/api/project?id=${projectId}`);
  const updates = useApi(`/api/activity-logs?projectId=${projectId}`);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedStaffGroup, setSelectedStaffGroup] = useState("");
  const [editProjectOpen, setEditProjectOpen] = useState(false);
const [editClientOpen, setEditClientOpen] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editError, setEditError] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [clientBusy, setClientBusy] = useState(false);
  const [projectForm, setProjectForm] = useState({
  id: "",
  name: "",
  location: "",
  startDate: "",
  endDate: "",
  contractValue: "",
});

const [clientForm, setClientForm] = useState({
  id: "",
  clientName: "",
  clientContact: "",
  clientEmail: "",
  clientAddress: "",
});

  const project = detail.data?.project;
  if (detail.loading) return <div className={cardClass()}>Loading project dashboard...</div>;
  if (detail.error) return <div className={cardClass()}>{getProjectErrorMessage(detail.error)}</div>;
  if (!project) return <div className={cardClass()}>Project not found.</div>;

  function openEditProject() {
  setProjectForm({
    id: project.id,
    name: project.name || "",
    location: project.location || "",
    startDate: project.start_date || "",
    endDate: project.end_date || "",
    contractValue: project.contract_value || "",
  });
  setEditProjectOpen(true);
}

function openEditClient() {
  setClientForm({
    id: project.id,
    clientName: project.client?.name || "",
    clientContact: project.client?.contact || "",
    clientEmail: project.client?.email || "",
    clientAddress: project.client?.address || "",
  });
  setEditClientOpen(true);
}
  
async function saveClientChanges(e) {
  e.preventDefault();
  if (clientBusy) return;
  setEditError("");
  setEditMessage("");
  setClientBusy(true);
  const res = await fetch("/api/project", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: project.id,
      name: project.name || "",
      location: project.location || "",
      clientName: clientForm.clientName || "",
      clientContact: clientForm.clientContact || "",
      clientEmail: clientForm.clientEmail || "",
      clientAddress: clientForm.clientAddress || "",
      startDate: project.start_date || "",
      endDate: project.end_date || "",
      contractValue: Number(project.contract_value || 0),
    }),
  });
  const json = await res.json().catch(() => null);
  // if (!res.ok) {
  //   setEditError(json?.error || "client_update_failed");
  //   setClientBusy(false);
  //   return;
  // }
  setEditMessage("Client info updated");
  setEditClientOpen(false);
  invalidateApiQuery("/api/projects");
  invalidateApiQuery("/api/dashboard");
  await Promise.all([detail.refresh(), updates.refresh()]);
  setClientBusy(false);
}

  async function saveProjectChanges(e) {
    e.preventDefault();
    if (projectBusy) return;
    setEditError("");
    setEditMessage("");
    setProjectBusy(true);
    const res = await fetch("/api/project", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: project.id,
        name: projectForm.name || "",
        location: projectForm.location || "",
        clientName: project.client?.name || "",
        clientContact: project.client?.contact || "",
        clientEmail: project.client?.email || "",
        clientAddress: project.client?.address || "",
        startDate: projectForm.startDate || "",
        endDate: projectForm.endDate || "",
        contractValue: Number(projectForm.contractValue || 0),
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setEditError(json?.error || "project_update_failed");
    //   setProjectBusy(false);
    //   return;
    // }
    setEditMessage("Project info updated");
    setEditProjectOpen(false);
    invalidateApiQuery("/api/projects");
    invalidateApiQuery("/api/dashboard");
    await Promise.all([detail.refresh(), updates.refresh()]);
    setProjectBusy(false);
  }

  const profileDetails =
    selectedType === "client"
      ? [
          { label: "Client", value: project.client?.name },
          { label: "Contact", value: project.client?.contact },
          { label: "Email", value: project.client?.email },
          { label: "Address", value: project.client?.address },
        ]
      : selectedType === "task"
        ? [
            { label: "Task", value: selectedItem?.title },
            { label: "Description", value: selectedItem?.description || "-" },
            { label: "Dates", value: `${formatDate(selectedItem?.start_date)} to ${formatDate(selectedItem?.end_date)}` },
            { label: "Approval Role", value: selectedItem?.approval_role || "-" },
            {
              label: "Assignments",
              value:
                (selectedItem?.assignments ?? [])
                  .map((assignment) => `${assignment.assignee?.name || assignment.assignee?.user_code} (${assignment.status})`)
                  .join(", ") || "-",
            },
          ]
        : [
            { label: "User ID", value: selectedItem?.staff?.user_code || selectedItem?.user_code },
            { label: "User Name", value: selectedItem?.staff?.user_name || selectedItem?.user_name || selectedItem?.staff?.user_code || selectedItem?.user_code },
            { label: "Name", value: selectedItem?.staff?.name || selectedItem?.name },
            { label: "Email", value: selectedItem?.staff?.email || selectedItem?.email },
            { label: "Mobile", value: selectedItem?.staff?.mobile || selectedItem?.mobile },
            { label: "Role", value: selectedItem?.staff?.role || selectedItem?.role || "-" },
          ];

  return (
    <>
      <InlineMessage error={editError} message={editMessage} />
      <section className="grid gap-4">
        <div className={cardClass()}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-2xl font-bold">{project.name}</div>
              <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{project.job_number}</div>
              <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{project.location || "-"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button type="button" onClick={() => setSelectedStaffGroup("managers")} className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3 text-left">
                <div className="text-xs text-[color:var(--acm-muted-fg)]">Managers</div>
                <div className="mt-1 flex items-center gap-2 text-xl font-bold"><TeamIcon className="h-4 w-4 text-[color:var(--acm-accent)]" />{project.managers.length}</div>
              </button>
              <button type="button" onClick={() => setSelectedStaffGroup("employees")} className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3 text-left">
                <div className="text-xs text-[color:var(--acm-muted-fg)]">Employees</div>
                <div className="mt-1 flex items-center gap-2 text-xl font-bold"><TeamIcon className="h-4 w-4 text-[color:var(--acm-accent)]" />{project.employees.length}</div>
              </button>
              <div className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
                <div className="text-xs text-[color:var(--acm-muted-fg)]">Tasks</div>
                <div className="mt-1 flex items-center gap-2 text-xl font-bold"><PulseIcon className="h-4 w-4 text-[color:var(--acm-accent)]" />{project.tasks.length}</div>
              </div>
              <div className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
                <div className="text-xs text-[color:var(--acm-muted-fg)]">Estimate Budget</div>
                <div className="mt-1 text-xl font-bold">${project.contract_value}</div>
              </div>
            </div>
          </div>
        </div>

        {section === "overview" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className={cardClass()}>
              <SectionHeader
                title="Project Info"
                action={
                  ownerMode ? (
                    <button type="button" onClick={openEditProject} className="acm-btn acm-btn-secondary h-10 px-4">
                      Edit Project Info
                    </button>
                  ) : null
                }
              />
              <div className="space-y-2">
                <DetailRow label="Project" value={project.name} />
                <DetailRow label="Job Number" value={project.job_number} />
                <DetailRow label="Location" value={project.location} />
                <DetailRow label="Start Date" value={formatDate(project.start_date)} />
                <DetailRow label="End Date" value={formatDate(project.end_date)} />
                <DetailRow label="Estimate Budget" value={`$${project.contract_value}`} />
              </div>
            </div>

            <div className={cardClass()}>
              <SectionHeader
                title="Client Info"
                action={
  <div className="flex gap-3 items-center">
    {/* <button
      type="button"
      onClick={() => setSelectedType("client")}
      className="acm-btn acm-btn-secondary h-10 px-4"
    >
      Open Profile
    </button> */}

    {ownerMode && (
      <>
        <button
          type="button"
          onClick={openEditClient}
          className="acm-btn acm-btn-secondary h-10 px-4"
        >
          Edit Client
        </button>

       
      </>
    )}
  </div>
}
              />
              <div className="space-y-2">
                <DetailRow label="Client" value={project.client?.name} />
                <DetailRow label="Contact" value={project.client?.contact} />
                <DetailRow label="Email" value={project.client?.email} />
                <DetailRow label="Address" value={project.client?.address} />
              </div>
            </div>

            <div className="xl:col-span-2">
              <UpdatesCard logs={(updates.data?.logs ?? []).slice(0, 8)} />
            </div>
          </div>
        ) : null}

        {section === "staff" ? (
          <StaffManagerPage
            allowManagerCreation={ownerMode}
            managerProjectOnly={roleBase === "manager"}
            ownerMode={ownerMode}
            fixedProjectId={projectId}
            readOnly={roleBase === "employee"}
            canAssignManagers={ownerMode}
            currentUserId={currentUserId}
          />
        ) : null}

        {section === "tasks" ? (
          <TasksManagerPage
            roleBase={roleBase}
            canAssignManagers={roleBase === "owner"}
            canCreateTask={roleBase !== "employee"}
            fixedProjectId={projectId}
            currentUserId={currentUserId}
          />
        ) : null}

        {section === "estimates" ? <ProjectEstimatesPage projectId={projectId} canManage={roleBase !== "employee"} /> : null}
        {section === "reports" ? <ProjectFieldReportsPage projectId={projectId} roleBase={roleBase} currentUserId={currentUserId} /> : null}
        {section === "expenses" ? <div className={cardClass()}>Expenses will be configured here.</div> : null}
      </section>

      <ProfileModal
        open={Boolean(selectedItem || selectedType === "client")}
        title={selectedType === "client" ? "Client Profile" : selectedType === "task" ? "Task Profile" : "User Profile"}
        details={profileDetails}
        onClose={() => {
          setSelectedItem(null);
          setSelectedType("");
        }}
      />

      <Modal
        open={Boolean(selectedStaffGroup)}
        title={selectedStaffGroup === "managers" ? "Project Managers" : "Project Employees"}
        onClose={() => setSelectedStaffGroup("")}
      >
        <div className="space-y-3">
          {(selectedStaffGroup === "managers" ? project.managers : project.employees).map((entry) => (
            <CompactListRow
              key={entry.user_id}
              primary={entry.staff?.name || entry.staff?.user_code || "Staff"}
              secondary={`${entry.staff?.user_code || "-"} | ${roleName(entry.role)}`}
              tertiary={`Hourly Rate: ${entry.hourly_rate ?? 0}`}
              onClick={() => {
                setSelectedStaffGroup("");
                setSelectedItem(entry);
                setSelectedType("staff");
              }}
            />
          ))}
          {!(selectedStaffGroup === "managers" ? project.managers : project.employees).length ? (
            <div className="text-sm text-[color:var(--acm-muted-fg)]">No staff assigned in this group yet.</div>
          ) : null}
        </div>
      </Modal>

     <Modal open={editClientOpen} title="Edit Client Info" onClose={() => setEditClientOpen(false)}>
  <form onSubmit={saveClientChanges} className="grid gap-3">
    <LabeledField label="Client Name">
      <input className={fieldClass()} value={clientForm.clientName} onChange={(e) => setClientForm(p => ({ ...p, clientName: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Contact">
      <input className={fieldClass()} value={clientForm.clientContact} onChange={(e) => setClientForm(p => ({ ...p, clientContact: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Email">
      <input type="email" className={fieldClass()} value={clientForm.clientEmail} onChange={(e) => setClientForm(p => ({ ...p, clientEmail: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Address">
      <textarea className={fieldClass()} value={clientForm.clientAddress} onChange={(e) => setClientForm(p => ({ ...p, clientAddress: e.target.value }))} />
    </LabeledField>

    <BusyButton type="submit" busy={clientBusy} className="acm-btn acm-btn-primary">Save</BusyButton>
  </form>
</Modal>
<Modal open={editProjectOpen} title="Edit Project Info" onClose={() => setEditProjectOpen(false)}>
  <form onSubmit={saveProjectChanges} className="grid gap-3">
    <LabeledField label="Project Name">
      <input className={fieldClass()} value={projectForm.name} onChange={(e) => setProjectForm(p => ({ ...p, name: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Location">
      <input className={fieldClass()} value={projectForm.location} onChange={(e) => setProjectForm(p => ({ ...p, location: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Start Date">
      <input type="date" className={fieldClass()} value={projectForm.startDate} onChange={(e) => setProjectForm(p => ({ ...p, startDate: e.target.value }))} />
    </LabeledField>

    <LabeledField label="End Date">
      <input type="date" className={fieldClass()} value={projectForm.endDate} onChange={(e) => setProjectForm(p => ({ ...p, endDate: e.target.value }))} />
    </LabeledField>

    <LabeledField label="Budget">
      <input className={fieldClass()} value={projectForm.contractValue} onChange={(e) => setProjectForm(p => ({ ...p, contractValue: e.target.value }))} />
    </LabeledField>

    <BusyButton type="submit" busy={projectBusy} className="acm-btn acm-btn-primary">Save</BusyButton>
  </form>
</Modal>


    </>
  );
}
export function StaffManagerPage({
  allowManagerCreation,
  managerProjectOnly = false,
  ownerMode = false,
  fixedProjectId = "",
  readOnly = false,
  canAssignManagers = false,
  currentUserId = "",
}) {
  const staff = useApi("/api/staff");
  const projects = useApi("/api/projects");
  const [tab, setTab] = useState("managers");
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [form, setForm] = useState({
    name: "",
    userName: "",
    role: "employee",
    email: "",
    mobile: "",
    hourlyRate: "",
    craft: "",
    projectId: "",
    password: "",
  });
  const [assignForm, setAssignForm] = useState({
    userId: "",
    projectId: "",
    role: allowManagerCreation ? "manager" : "employee",
    hourlyRate: "",
  });

  const staffData = useMemo(() => staff.data?.staff ?? { managers: [], employees: [], subcontractors: [] }, [staff.data]);
  const projectList = projects.data?.projects ?? [];
  const availableProjects = fixedProjectId ? projectList.filter((project) => project.id === fixedProjectId) : projectList;
  const defaultProjectId = fixedProjectId || getProjectDefaultId(availableProjects);
  const selectedProjectId = form.projectId || defaultProjectId;
  const selectedAssignmentProjectId = assignForm.projectId || defaultProjectId;
  const visibleStaffData = useMemo(() => {
    if (!fixedProjectId) return staffData;

    const inProject = (item) =>
      item?.created_in_project_id === fixedProjectId ||
      (item?.project_assignments ?? []).some((assignment) => assignment.project_id === fixedProjectId);

    return {
      managers: staffData.managers.filter(inProject),
      employees: staffData.employees.filter(inProject),
      subcontractors: staffData.subcontractors.filter(inProject),
    };
  }, [fixedProjectId, staffData]);

  function canManageThisStaff(item) {
    return !readOnly && (ownerMode ? item.role !== "owner" : item.role === "employee" && item.user_id !== currentUserId);
  }

  async function createStaff(e) {
    e.preventDefault();
    if (createBusy) return;
    setError("");
    setMessage("");
    setCreateBusy(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        hourlyRate: Number(form.hourlyRate || 0),
        craft: form.craft?.trim() || null,
        projectId: selectedProjectId || null,
        userName: form.userName?.trim() || null,
        password: form.password?.trim() || null,
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "staff_create_failed");
    //   setCreateBusy(false);
    //   return;
    // }
    setMessage(`Created. User ID: ${json.staff.user_code}, User Name: ${json.auth.userName}, Password: ${json.auth.temporaryPassword}`);
    setOpen(false);
    invalidateApiQuery("/api/dashboard");
    invalidateApiQuery("/api/staff");
    await Promise.all([staff.refresh(), projects.refresh()]);
    setCreateBusy(false);
  }

  async function updateStaff(e) {
    e.preventDefault();
    if (!editingStaff) return;
    if (editBusy) return;
    setError("");
    setMessage("");
    setEditBusy(true);
    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: editingStaff.user_id,
        name: editingStaff.name,
        userName: editingStaff.user_name,
        email: editingStaff.email,
        mobile: editingStaff.mobile,
        hourlyRate: Number(editingStaff.hourly_rate || 0),
        craft: editingStaff.craft || "",
        password: editingStaff.password || "",
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "staff_update_failed");
    //   setEditBusy(false);
    //   return;
    // }
    setMessage("Staff updated");
    setEditOpen(false);
    invalidateApiQuery("/api/staff");
    await staff.refresh();
    setEditBusy(false);
  }

  async function assignProject(e) {
    e.preventDefault();
    if (assignBusy) return;
    setError("");
    setMessage("");
    setAssignBusy(true);
    const res = await fetch("/api/project-assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...assignForm,
        projectId: selectedAssignmentProjectId,
        hourlyRate: Number(assignForm.hourlyRate || 0),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error || "assignment_failed");
      setAssignBusy(false);
      return;
    }
    setMessage(json?.message || "Project assigned");
    setAssignOpen(false);
    invalidateApiQuery("/api/staff");
    invalidateApiQuery("/api/projects");
    invalidateApiQuery("/api/dashboard");
    await Promise.all([staff.refresh(), projects.refresh()]);
    setAssignBusy(false);
  }

  async function deleteStaff(item) {
    if (!window.confirm(`Delete ${item.name || item.user_code}?`)) return;
    if (deleteUserId) return;
    setError("");
    setMessage("");
    setDeleteUserId(item.user_id);
    const res = await fetch("/api/staff", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: item.user_id }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "staff_delete_failed");
    //   setDeleteUserId("");
    //   return;
    // }
    setMessage("Staff deleted");
    invalidateApiQuery("/api/staff");
    invalidateApiQuery("/api/dashboard");
    await Promise.all([staff.refresh(), projects.refresh()]);
    setDeleteUserId("");
  }

  async function onSendEmail(userId) {
    try {
      const result = await sendCredentialEmail(userId);
      const mode = result.delivery?.mode;
      setMessage(
        mode === "supabase-reset"
          ? "Password reset email sent from Supabase."
          : result.delivery?.sent
            ? "Credentials email sent."
            : "Mail client opened with credentials."
      );
    } catch (err) {
      setError(err.message || "Unable to send email");
    }
  }

  function openEditStaff(item) {
    setEditingStaff({ ...item });
    setEditOpen(true);
  }

  async function openHistory(item) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryItems([]);
    const res = await fetch(`/api/activity-logs?userId=${item.user_id}`);
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "history_fetch_failed");
    //   setHistoryLoading(false);
    //   return;
    // }
    setHistoryItems(json?.logs ?? []);
    setHistoryLoading(false);
  }

  return (
    <>
      <SectionHeader
        // title="Staff"
        action={
          readOnly ? null : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setAssignOpen(true)} className="acm-btn acm-btn-secondary h-10 px-4">
                Assign Project
              </button>
              <button type="button" onClick={() => setOpen(true)} className="acm-btn acm-btn-primary h-10 px-4">
                Create
              </button>
            </div>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setTab("managers")} className={`acm-btn ${tab === "managers" ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}>
          Managers
        </button>
        <button type="button" onClick={() => setTab("employees")} className={`acm-btn ${tab === "employees" ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}>
          Employees
        </button>
        <button type="button" onClick={() => setTab("subcontractors")} className={`acm-btn ${tab === "subcontractors" ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}>
          Subcontractors
        </button>
      </div>

      <InlineMessage error={staff.error || error} message={message} />

      <section className="mt-4 space-y-3">
        {(visibleStaffData[tab] ?? []).map((item) => (
          <CompactListRow
            key={item.user_id}
            primary={item.name || item.user_name || item.user_code}
            secondary={`${item.user_name || item.user_code} | ${item.user_code} | ${roleName(item.role)}`}
            tertiary={`${item.email || "-"} | Hourly: ${item.hourly_rate || 0} | ${getProjectAssignmentSummary(item, fixedProjectId)}${item.craft ? ` | Craft: ${item.craft}` : ""}`}
            onClick={() => setSelectedProfile(item)}
            actions={
              <div className="flex flex-wrap gap-2">
                {canManageThisStaff(item) ? (
                  <>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openEditStaff(item); }} className="acm-btn acm-btn-secondary h-9 px-3 text-xs">
                      Edit
                    </button>
                    <BusyButton
                      type="button"
                      busy={deleteUserId === item.user_id}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteStaff(item);
                      }}
                    >
                      Delete
                    </BusyButton>
                  </>
                ) : null}
              </div>
            }
          />
        ))}
      </section>

      <ProfileModal
        open={Boolean(selectedProfile)}
        title="User Profile"
        details={
          selectedProfile
            ? [
                { label: "User ID", value: selectedProfile.user_code },
                { label: "User Name", value: selectedProfile.user_name || selectedProfile.user_code },
                { label: "Name", value: selectedProfile.name },
                { label: "Email", value: selectedProfile.email },
                { label: "Mobile", value: selectedProfile.mobile },
                { label: "Role", value: roleName(selectedProfile.role) },
                { label: "Hourly Rate", value: selectedProfile.hourly_rate || "0" },
                ...(selectedProfile.role === "subcontractor" ? [{ label: "Craft", value: selectedProfile.craft || "-" }] : []),
                { label: "Project", value: getProjectAssignmentSummary(selectedProfile, fixedProjectId) },
                {
                  label: "Assigned Projects",
                  value:
                    (selectedProfile.project_assignments ?? [])
                      .map((assignment) => assignment.project?.name || assignment.project_id)
                      .join(", ") || "-",
                },
                ...(!readOnly ? [{ label: "Password", value: selectedProfile.password || "-" }] : []),
              ]
            : []
        }
        onClose={() => setSelectedProfile(null)}
        onSendEmail={!readOnly && selectedProfile ? () => onSendEmail(selectedProfile.user_id) : null}
        actions={
          selectedProfile ? (
            <>
              <button type="button" onClick={() => openHistory(selectedProfile)} className="acm-btn acm-btn-secondary h-10 px-4">
                History
              </button>
              {canManageThisStaff(selectedProfile) ? (
                <>
              <button
                type="button"
                onClick={() => {
                  setSelectedProfile(null);
                  openEditStaff(selectedProfile);
                }}
                className="acm-btn acm-btn-secondary h-10 px-4"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedProfile(null);
                  deleteStaff(selectedProfile);
                }}
                className="acm-btn acm-btn-secondary h-10 px-4"
              >
                Delete
              </button>
                </>
              ) : null}
            </>
          ) : null
        }
      />

      <Modal open={historyOpen} title="Staff Ledger" onClose={() => setHistoryOpen(false)}>
        <div className="space-y-3">
          {historyLoading ? <div className="text-sm text-[color:var(--acm-muted-fg)]">Loading staff history...</div> : null}
          {!historyLoading && !historyItems.length ? <div className="text-sm text-[color:var(--acm-muted-fg)]">No staff history recorded yet.</div> : null}
          {historyItems.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
              <div className="font-semibold">{item.message}</div>
              <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={open} title="Create Staff" onClose={() => setOpen(false)}>
        <form onSubmit={createStaff} className="grid gap-3">
          <FieldGroup title="Profile">
            <LabeledField label="Name">
              <input className={fieldClass()} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Role">
              <select className={fieldClass()} value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
                {allowManagerCreation ? <option value="manager">Manager</option> : null}
                <option value="employee">Employee</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </LabeledField>
            <LabeledField label="Email">
              <input className={fieldClass()} value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Mobile">
              <input className={fieldClass()} value={form.mobile} onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Hourly Rate">
              <input className={fieldClass()} inputMode="decimal" value={form.hourlyRate} onChange={(e) => setForm((prev) => ({ ...prev, hourlyRate: e.target.value }))} />
            </LabeledField>
            {form.role === "subcontractor" ? (
              <LabeledField label="Craft">
                <input className={fieldClass()} value={form.craft} onChange={(e) => setForm((prev) => ({ ...prev, craft: e.target.value }))} />
              </LabeledField>
            ) : null}
            <LabeledField label="Assigned Project">
              <select className={fieldClass()} value={selectedProjectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))} disabled={Boolean(fixedProjectId)}>
                <option value="">Select project</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </LabeledField>
          </FieldGroup>
          <FieldGroup title="Credentials">
            <LabeledField label="User Name">
              <input className={fieldClass()} value={form.userName} onChange={(e) => setForm((prev) => ({ ...prev, userName: e.target.value }))} />
            </LabeledField>
            <LabeledField label="User ID">
              <input className={fieldClass()} value="Auto-generated on save" disabled />
            </LabeledField>
            <LabeledField label="Password">
              <PasswordInput className={fieldClass()} placeholder="Leave blank for auto-generated password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          {managerProjectOnly ? <div className="text-sm text-[color:var(--acm-muted-fg)]">Manager can create employees only inside an assigned project.</div> : null}
          <BusyButton type="submit" busy={createBusy} className="acm-btn acm-btn-primary">Save</BusyButton>
        </form>
      </Modal>

      <Modal open={assignOpen} title="Assign Project" onClose={() => setAssignOpen(false)}>
        <form onSubmit={assignProject} className="grid gap-3">
          <LabeledField label="Select Staff">
            <select className={fieldClass()} value={assignForm.userId} onChange={(e) => setAssignForm((prev) => ({ ...prev, userId: e.target.value }))}>
              <option value="">Select staff</option>
              {[...staffData.managers, ...staffData.employees].map((item) => (
                <option key={item.user_id} value={item.user_id}>{getStaffOptionLabel(item)}</option>
              ))}
              {(staffData.subcontractors ?? []).map((item) => (
                <option key={item.user_id} value={item.user_id}>{getStaffOptionLabel(item)}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Select Project">
            <select className={fieldClass()} value={selectedAssignmentProjectId} onChange={(e) => setAssignForm((prev) => ({ ...prev, projectId: e.target.value }))} disabled={Boolean(fixedProjectId)}>
              <option value="">Select project</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Role">
            <select className={fieldClass()} value={assignForm.role} onChange={(e) => setAssignForm((prev) => ({ ...prev, role: e.target.value }))}>
              {allowManagerCreation ? <option value="manager">Manager</option> : null}
              <option value="employee">Employee</option>
              <option value="subcontractor">Subcontractor</option>
            </select>
          </LabeledField>
          <LabeledField label="Hourly Rate">
            <input className={fieldClass()} inputMode="decimal" value={assignForm.hourlyRate} onChange={(e) => setAssignForm((prev) => ({ ...prev, hourlyRate: e.target.value }))} />
          </LabeledField>
          <BusyButton type="submit" busy={assignBusy} className="acm-btn acm-btn-primary">Assign</BusyButton>
        </form>
      </Modal>

      <Modal open={editOpen} title="Edit Staff" onClose={() => setEditOpen(false)}>
        <form onSubmit={updateStaff} className="grid gap-3">
          <FieldGroup title="Profile">
            <LabeledField label="Name">
              <input className={fieldClass()} value={editingStaff?.name || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Email">
              <input className={fieldClass()} value={editingStaff?.email || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Mobile">
              <input className={fieldClass()} value={editingStaff?.mobile || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, mobile: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Hourly Rate">
              <input className={fieldClass()} inputMode="decimal" value={editingStaff?.hourly_rate || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, hourly_rate: e.target.value }))} />
            </LabeledField>
            {editingStaff?.role === "subcontractor" ? (
              <LabeledField label="Craft">
                <input className={fieldClass()} value={editingStaff?.craft || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, craft: e.target.value }))} />
              </LabeledField>
            ) : null}
          </FieldGroup>
          <FieldGroup title="Credentials">
            <LabeledField label="User Name">
              <input className={fieldClass()} value={editingStaff?.user_name || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, user_name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="User ID">
              <input className={fieldClass()} value={editingStaff?.user_code || ""} disabled />
            </LabeledField>
            <LabeledField label="Password">
              <PasswordInput className={fieldClass()} placeholder="New password (optional)" value={editingStaff?.password || ""} onChange={(e) => setEditingStaff((prev) => ({ ...prev, password: e.target.value }))} />
            </LabeledField>
          </FieldGroup>
          <BusyButton type="submit" busy={editBusy} className="acm-btn acm-btn-primary">Save</BusyButton>
        </form>
      </Modal>

    </>
  );
}

function getTaskStatusBadgeClass(status) {
  if (status === "approved") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (status === "submitted") return "border-sky-500/25 bg-sky-500/10 text-sky-700";
  if (status === "rejected") return "border-rose-500/25 bg-rose-500/10 text-rose-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function getTaskStatusLabel(status) {
  if (!status) return "-";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getApprovalRoleLabel(role) {
  return role === "manager" ? "Manager Approval" : role === "employee" ? "Employee Approval" : "-";
}

function buildTaskDetails(task) {
  return [
    { label: "Task", value: task?.title ?? "-" },
    { label: "Project", value: task?.project?.name ?? "-" },
    { label: "Description", value: task?.description ?? "-" },
    { label: "Date Range", value: `${formatDate(task?.start_date)} - ${formatDate(task?.end_date)}` },
    { label: "Status", value: getTaskStatusLabel(task?.status) },
    { label: "Approving Person", value: task?.approver?.name ?? task?.approver?.user_code ?? "-" },
    {
      label: "Assigned Users",
      value:
        (task?.assignments ?? [])
          .map((assignment) => `${assignment.assignee?.name ?? assignment.assignee?.user_code ?? "-"} (${getTaskStatusLabel(assignment.status)})`)
          .join(", ") || "-",
    },
    {
      label: "Remarks",
      value:
        (task?.assignments ?? [])
          .map((assignment) => assignment.latest_approval?.comment)
          .filter(Boolean)
          .join(", ") || "-",
    },
  ];
}

export function TasksManagerPage({
  roleBase = "owner",
  canAssignManagers = false,
  canCreateTask = false,
  fixedProjectId = "",
  currentUserId = "",
}) {
  return (
    <TaskModulePage
      roleBase={roleBase}
      canAssignManagers={canAssignManagers}
      canCreateTask={canCreateTask}
      fixedProjectId={fixedProjectId}
      currentUserId={currentUserId}
    />
  );
}

function escapeSvgText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgToDataUrl(svg) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildSignatureDataUrl(name) {
  const safeName = escapeSvgText(name || "Owner Signature");
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
      <rect width="640" height="180" fill="#ffffff"/>
      <text x="24" y="112" font-family="Segoe Script, Brush Script MT, cursive" font-size="56" fill="#102033">${safeName}</text>
      <path d="M24 126h410" stroke="#102033" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `);
}

function buildStampDataUrl(companyName) {
  const safeName = escapeSvgText((companyName || "COMPANY").toUpperCase());
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#ffffff"/>
      <circle cx="120" cy="120" r="94" fill="none" stroke="#0f4c81" stroke-width="8"/>
      <circle cx="120" cy="120" r="72" fill="none" stroke="#0f4c81" stroke-width="2" stroke-dasharray="6 6"/>
      <text x="120" y="100" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#0f4c81">APPROVED</text>
      <text x="120" y="136" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="#0f4c81">${safeName}</text>
    </svg>
  `);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function AssetUploadField({ label, helper, onChange }) {
  return (
    <div className="mt-3">
      <label className="inline-flex cursor-pointer items-center rounded-[14px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--acm-fg)] transition hover:bg-[color:var(--acm-surface-2)]">
        {label}
        <input className="hidden" type="file" accept="image/*" onChange={onChange} />
      </label>
      <div className="mt-2 text-xs text-[color:var(--acm-muted-fg)]">{helper}</div>
    </div>
  );
}

export function SettingsPage() {
  const settings = useApi("/api/settings");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [companyForm, setCompanyForm] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const isOwner = settings.data?.profile?.role === "owner";
  const resolvedProfileForm = profileForm ?? {
    name: settings.data?.profile?.name || "",
    userName: settings.data?.profile?.userName || settings.data?.profile?.userCode || "",
    userCode: settings.data?.profile?.userCode || "",
    email: settings.data?.profile?.email || "",
    mobile: settings.data?.profile?.mobile || "",
    address: settings.data?.profile?.address || "",
  };
  const resolvedCompanyForm = companyForm ?? {
    name: settings.data?.company?.name || "",
    code: settings.data?.company?.code || "",
    address: settings.data?.company?.address || "",
    contact: settings.data?.company?.contact || "",
    email: settings.data?.company?.email || "",
    logoDataUrl: settings.data?.company?.logoDataUrl || "",
    logoPath: settings.data?.company?.logoPath || "",
    signatureDataUrl: settings.data?.company?.signatureDataUrl || "",
    signaturePath: settings.data?.company?.signaturePath || "",
    signatureName: settings.data?.company?.signatureName || settings.data?.profile?.name || "",
    stampDataUrl: settings.data?.company?.stampDataUrl || "",
    stampPath: settings.data?.company?.stampPath || "",
    stampLabel: settings.data?.company?.stampLabel || settings.data?.company?.name || "",
  };

  useEffect(() => {
    if (!isOwner || !settings.data?.company) return;

    queueMicrotask(() => {
      setCompanyForm((current) => {
        if (current) return current;
        const next = {
          name: settings.data.company.name || "",
          code: settings.data.company.code || "",
          address: settings.data.company.address || "",
          contact: settings.data.company.contact || "",
          email: settings.data.company.email || "",
          logoDataUrl: settings.data.company.logoDataUrl || "",
          logoPath: settings.data.company.logoPath || "",
          signatureDataUrl: settings.data.company.signatureDataUrl || "",
          signaturePath: settings.data.company.signaturePath || "",
          signatureName: settings.data.company.signatureName || settings.data?.profile?.name || "",
          stampDataUrl: settings.data.company.stampDataUrl || "",
          stampPath: settings.data.company.stampPath || "",
          stampLabel: settings.data.company.stampLabel || settings.data.company.name || "",
        };

        return {
          ...next,
          signatureDataUrl: next.signatureDataUrl || buildSignatureDataUrl(next.signatureName || settings.data?.profile?.name || ""),
          stampDataUrl: next.stampDataUrl || buildStampDataUrl(next.stampLabel || next.name),
        };
      });
    });
  }, [isOwner, settings.data?.company, settings.data?.profile?.name]);

  async function handleAssetUpload(field, file) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), [field]: dataUrl }));
      setMessage("");
      setError("");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to read file.");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (profileBusy) return;
    setError("");
    setMessage("");
    setProfileBusy(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...resolvedProfileForm,
        ...(isOwner ? { company: resolvedCompanyForm } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "settings_update_failed");
    //   setProfileBusy(false);
    //   return;
    // }
    setMessage(isOwner ? "Profile and company details updated." : "Personal details updated.");
    await settings.refresh();
    setProfileBusy(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    if (passwordBusy) return;
    setError("");
    setMessage("");
    setPasswordBusy(true);
    if (!passwordForm.password || passwordForm.password.length < 8) {
      setError("Password must be at least 8 characters.");
      setPasswordBusy(false);
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError("Passwords do not match.");
      setPasswordBusy(false);
      return;
    }

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...resolvedProfileForm,
        password: passwordForm.password,
        ...(isOwner ? { company: resolvedCompanyForm } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    // if (!res.ok) {
    //   setError(json?.error || "password_update_failed");
    //   setPasswordBusy(false);
    //   return;
    // }

    setPasswordForm({ password: "", confirmPassword: "" });
    setMessage("Credentials updated.");
    setPasswordBusy(false);
  }

  return (
    <>
      {/* <SectionHeader title="Profile" /> */}
      <InlineMessage error={settings.error || error} message={message} />

      <section className="grid gap-4">
        <form onSubmit={saveProfile} className="grid gap-4">
          <div className={`grid gap-4 ${isOwner ? "xl:grid-cols-2" : ""}`}>
            <div className={cardClass()}>
              <SectionHeader title="Personal Details" />
              <div className="grid gap-3">
            <LabeledField label="Name">
              <input className={fieldClass()} value={resolvedProfileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...(prev ?? resolvedProfileForm), name: e.target.value }))} />
            </LabeledField>
            <LabeledField label="User ID">
              <input className={fieldClass()} value={resolvedProfileForm.userCode} readOnly />
            </LabeledField>
            <LabeledField label="User Name">
              <input className={fieldClass()} value={resolvedProfileForm.userName} onChange={(e) => setProfileForm((prev) => ({ ...(prev ?? resolvedProfileForm), userName: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Email">
              <input className={fieldClass()} type="email" value={resolvedProfileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...(prev ?? resolvedProfileForm), email: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Mobile">
              <input className={fieldClass()} value={resolvedProfileForm.mobile} onChange={(e) => setProfileForm((prev) => ({ ...(prev ?? resolvedProfileForm), mobile: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Address">
              <textarea className={fieldClass()} rows={4} value={resolvedProfileForm.address} onChange={(e) => setProfileForm((prev) => ({ ...(prev ?? resolvedProfileForm), address: e.target.value }))} />
            </LabeledField>
              </div>
            </div>

            {isOwner ? (
              <div className={cardClass()}>
                <SectionHeader title="Company Details" />
                <div className="mb-3 text-sm text-[color:var(--acm-muted-fg)]">
                  These details are fetched automatically into estimate PDFs and outgoing email sends.
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledField label="Company Name">
                      <input className={fieldClass()} value={resolvedCompanyForm.name} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), name: e.target.value, stampLabel: e.target.value || (prev ?? resolvedCompanyForm).stampLabel }))} />
                    </LabeledField>
                    <LabeledField label="Company Code">
                      <input className={fieldClass()} value={resolvedCompanyForm.code} readOnly />
                    </LabeledField>
                    <LabeledField label="Company Email">
                      <input className={fieldClass()} type="email" value={resolvedCompanyForm.email} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), email: e.target.value }))} />
                    </LabeledField>
                    <LabeledField label="Company Contact">
                      <input className={fieldClass()} value={resolvedCompanyForm.contact} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), contact: e.target.value }))} />
                    </LabeledField>
                  </div>
                  <LabeledField label="Company Address">
                    <textarea className={fieldClass()} rows={4} value={resolvedCompanyForm.address} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), address: e.target.value }))} />
                  </LabeledField>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                      <div className="mb-3 text-sm font-semibold text-[color:var(--acm-fg)]">Logo</div>
                      {resolvedCompanyForm.logoDataUrl ? <img src={resolvedCompanyForm.logoDataUrl} alt="Company logo" className="h-28 w-full rounded-[16px] object-contain bg-white p-2" /> : <div className="flex h-28 items-center justify-center rounded-[16px] bg-[color:var(--acm-surface)] text-sm text-[color:var(--acm-muted-fg)]">No logo uploaded</div>}
                      <AssetUploadField label="Upload Logo" helper={resolvedCompanyForm.logoDataUrl ? "Logo uploaded." : "Choose a logo image."} onChange={(e) => handleAssetUpload("logoDataUrl", e.target.files?.[0])} />
                    </div>

                    <div className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Signature</div>
                        <button type="button" onClick={() => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), signatureDataUrl: buildSignatureDataUrl((prev ?? resolvedCompanyForm).signatureName || resolvedProfileForm.name) }))} className="acm-btn acm-btn-secondary h-9 px-3">Generate</button>
                      </div>
                      <LabeledField label="Owner Name">
                        <input className={fieldClass()} value={resolvedCompanyForm.signatureName} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), signatureName: e.target.value }))} />
                      </LabeledField>
                      {resolvedCompanyForm.signatureDataUrl ? <img src={resolvedCompanyForm.signatureDataUrl} alt="Owner signature" className="mt-3 h-28 w-full rounded-[16px] object-contain bg-white p-2" /> : null}
                      <AssetUploadField label="Upload Signature" helper={resolvedCompanyForm.signatureDataUrl ? "Signature ready." : "Choose a signature image or generate one."} onChange={(e) => handleAssetUpload("signatureDataUrl", e.target.files?.[0])} />
                    </div>

                    <div className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Stamp</div>
                        <button type="button" onClick={() => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), stampDataUrl: buildStampDataUrl((prev ?? resolvedCompanyForm).stampLabel || (prev ?? resolvedCompanyForm).name) }))} className="acm-btn acm-btn-secondary h-9 px-3">Generate</button>
                      </div>
                      <LabeledField label="Stamp Label">
                        <input className={fieldClass()} value={resolvedCompanyForm.stampLabel} onChange={(e) => setCompanyForm((prev) => ({ ...(prev ?? resolvedCompanyForm), stampLabel: e.target.value }))} />
                      </LabeledField>
                      {resolvedCompanyForm.stampDataUrl ? <img src={resolvedCompanyForm.stampDataUrl} alt="Company stamp" className="mt-3 h-28 w-full rounded-[16px] object-contain bg-white p-2" /> : null}
                      <AssetUploadField label="Upload Stamp" helper={resolvedCompanyForm.stampDataUrl ? "Stamp ready." : "Choose a stamp image or generate one."} onChange={(e) => handleAssetUpload("stampDataUrl", e.target.files?.[0])} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <BusyButton type="submit" busy={profileBusy} className="acm-btn acm-btn-primary w-fit px-5">Save Details</BusyButton>
        </form>

        <div className={cardClass()}>
          <SectionHeader title="Change Credentials" />
          <div className="mb-3 text-sm text-[color:var(--acm-muted-fg)]">
            Update your user name and password for future logins. Your User ID stays fixed.
          </div>
          <form onSubmit={changePassword} className="grid gap-3">
            <LabeledField label="New Password">
              <PasswordInput className={fieldClass()} value={passwordForm.password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))} />
            </LabeledField>
            <LabeledField label="Confirm Password">
              <PasswordInput className={fieldClass()} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
            </LabeledField>
            <BusyButton type="submit" busy={passwordBusy} className="acm-btn acm-btn-primary">Update Credentials</BusyButton>
          </form>
        </div>
      </section>
    </>
  );
}
