"use client";

import { useCallback, useMemo, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { TaskBoardControls } from "@/features/tasks/components/TaskBoardControls";
import { TaskListSection } from "@/features/tasks/components/TaskListSection";
import { useTasksBoard } from "@/features/tasks/hooks/useTasksBoard";
import { useTaskMutations } from "@/features/tasks/hooks/useTaskMutations";
import { useTaskBoardViewState } from "@/features/tasks/hooks/useTaskBoardViewState";
import {
  AppDialog,
  TaskCard,
  TaskReviewPanel,
  UserSelector,
} from "@/components/dashboard/task/TaskWidgets";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass(error = false) {
  return `acm-input mt-0 ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`.trim();
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

function matchesSearchQuery(query, ...values) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return Object.values(value);
      return [value];
    })
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
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

function getApprovalRoleLabel(role) {
  return role === "manager" ? "Manager Approval" : role === "employee" ? "Employee Approval" : role === "subcontractor" ? "Subcontractor" : "-";
}

function buildTaskDetails(task) {
  return [
    { label: "Task", value: task?.title ?? "-" },
    { label: "Project", value: task?.project?.name ?? "-" },
    { label: "Description", value: task?.description ?? "-" },
    { label: "Date Range", value: `${formatDate(task?.start_date)} - ${formatDate(task?.end_date)}` },
    { label: "Status", value: task?.status ?? "-" },
    { label: "Approving Person", value: task?.approver?.name ?? task?.approver?.user_code ?? "-" },
    {
      label: "Assigned Users",
      value:
        (task?.assignments ?? [])
          .map((assignment) => `${assignment.assignee?.name ?? assignment.assignee?.user_code ?? "-"} (${assignment.status})`)
          .join(", ") || "-",
    },
  ];
}

function getApproverOptions(staffData, projectId, role) {
  const source = role === "manager" ? staffData.managers ?? [] : staffData.employees ?? [];
  return source.filter((item) => {
    if (!projectId) return true;
    return (item.project_assignments ?? []).some((assignment) => assignment.project_id === projectId);
  });
}

function normalizeTaskForm(projectId = "") {
  return {
    id: "",
    projectId,
    assigneeUserIds: [],
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    approvalRole: "manager",
    approverUserId: "",
  };
}

function normalizeSubmissionFiles(submission) {
  if (!submission) return [];

  if (Array.isArray(submission.files) && submission.files.length) {
    return submission.files.filter((file) => file?.dataUrl);
  }

  return (submission.photos ?? [])
    .filter(Boolean)
    .map((dataUrl, index) => ({
      name: `Image ${index + 1}`,
      type: "image/*",
      size: null,
      dataUrl,
    }));
}

function buildDecoratedTask(task) {
  return {
    ...task,
    dateRangeLabel: `${formatDate(task.start_date)} - ${formatDate(task.end_date)}`,
    assignedUsersLabel:
      (task.assignments ?? []).map((assignment) => assignment.assignee?.name ?? assignment.assignee?.user_code ?? "-").join(", ") || "-",
    approverLabel: task.approver?.name ?? task.approver?.user_code ?? "-",
    approvalRoleLabel: getApprovalRoleLabel(task.approval_role),
    remarkLabel:
      (task.assignments ?? [])
        .map((assignment) => assignment.latest_approval?.comment)
        .filter(Boolean)
        .join(", ") || "",
  };
}

function getRelevantAssignments(task, tab, currentUserId) {
  if (tab === "my") return task.my_assignments ?? [];
  if (tab === "approvals") return (task.assignments ?? []).filter((assignment) => assignment.status === "submitted");
  if (tab === "approved") {
    return (task.assignments ?? []).filter(
      (assignment) => assignment.latest_approval?.approved_by_user_id === currentUserId
    );
  }
  return task.assignments ?? [];
}

function matchesStatusFilter(task, statusFilter, tab, currentUserId) {
  if (statusFilter === "all") return true;
  const relevantAssignments = getRelevantAssignments(task, tab, currentUserId);

  if (statusFilter === "assigned") {
    return relevantAssignments.some((assignment) => assignment.status === "assigned" && !assignment.latest_submission);
  }

  if (statusFilter === "submitted") {
    return relevantAssignments.some((assignment) => assignment.status === "submitted" || assignment.latest_submission?.created_at);
  }

  return relevantAssignments.some((assignment) => assignment.status === statusFilter);
}

function scrollToField(fieldName) {
  if (!fieldName || typeof window === "undefined") return;
  const container = document.querySelector(`[data-task-field="${fieldName}"]`);
  if (!container) return;
  container.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = container.querySelector("input, textarea, select, button");
  input?.focus?.();
}

function validateTaskForm(form, fixedProjectId) {
  const errors = {};
  const activeProjectId = form.projectId || fixedProjectId;

  if (!activeProjectId) errors.projectId = "Project is required.";
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (form.endDate && form.startDate && form.endDate < form.startDate) {
    errors.endDate = "End date cannot be before start date.";
  }
  if (!form.assigneeUserIds.length) errors.assigneeUserIds = "Select at least one assignee.";
  if (!form.approvalRole) errors.approvalRole = "Approval role is required.";
  if (!form.approverUserId) errors.approverUserId = "Approving person is required.";

  return errors;
}

function validateSubmissionForm(submitForm) {
  const errors = {};
  if (!submitForm.workDescription.trim()) {
    errors.workDescription = "Work description is required.";
  }
  return errors;
}

function validateReviewForm(reviewForm) {
  const errors = {};
  if (reviewForm.action === "rejected" && !reviewForm.comment.trim()) {
    errors.comment = "A remark is required when rejecting a submission.";
  }
  return errors;
}

function LabeledField({ label, fieldName, error = "", children }) {
  return (
    <label className="relative block pt-3" data-task-field={fieldName}>
      <span className="acm-field-label">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-rose-700">{error}</span> : null}
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

function InlineMessage({ error, message }) {
  if (error) {
    return <div className="acm-message-error">{error}</div>;
  }

  if (message) {
    return (
      <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
        {message}
      </div>
    );
  }

  return null;
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function ProfileModal({ open, title, details, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-2">
        {details.map((detail) => (
          <DetailRow key={`${detail.label}-${detail.value}`} label={detail.label} value={detail.value} />
        ))}
      </div>
    </Modal>
  );
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: typeof reader.result === "string" ? reader.result : "",
      });
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function TasksManagerPage({
  roleBase = "owner",
  canAssignManagers = false,
  canCreateTask = false,
  fixedProjectId = "",
  currentUserId = "",
}) {
  const {
    tasksQuery: tasks,
    projectsQuery: projects,
    staffQuery: staff,
    taskGroups,
    projectList,
    staffData,
  } = useTasksBoard({ fixedProjectId });
  const {
    saveTask: persistTask,
    deleteTask: removeTask,
    submitTaskWork,
    reviewTaskSubmission,
  } = useTaskMutations({
    fixedProjectId,
    refreshStaff: staff.refresh,
  });
  const {
    tab,
    sortBy,
    statusFilter,
    projectFilter,
    roleFilter,
    searchQuery,
    deferredSearchQuery,
    updateTab,
    updateSortBy,
    updateStatusFilter,
    updateProjectFilter,
    updateRoleFilter,
    updateSearchQuery,
  } = useTaskBoardViewState({ fixedProjectId });
  const [open, setOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => normalizeTaskForm(fixedProjectId || ""));
  const [formErrors, setFormErrors] = useState({});
  const [submitForm, setSubmitForm] = useState({ workDescription: "", files: [], blocker: "" });
  const [submitErrors, setSubmitErrors] = useState({});
  const [reviewForm, setReviewForm] = useState({ action: "approved", comment: "" });
  const [reviewErrors, setReviewErrors] = useState({});
  const [dialogState, setDialogState] = useState({ open: false, title: "", message: "", onConfirm: null, tone: "default" });
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

  const availableProjects = fixedProjectId ? projectList.filter((project) => project.id === fixedProjectId) : projectList;
  const activeProjectId = form.projectId || fixedProjectId || getProjectDefaultId(availableProjects);

  const availableAssignees = useMemo(() => {
    const source = canAssignManagers
      ? [...staffData.managers, ...staffData.employees, ...(staffData.subcontractors ?? [])]
      : [...staffData.employees, ...(staffData.subcontractors ?? [])];
    const byUserId = new Map();

    source.forEach((item) => {
      if (activeProjectId) {
        const isAssignedToProject = (item.project_assignments ?? []).some((assignment) => assignment.project_id === activeProjectId);
        if (!isAssignedToProject) return;
      }
      byUserId.set(item.user_id, item);
    });

    return [...byUserId.values()].sort((left, right) => getStaffOptionLabel(left).localeCompare(getStaffOptionLabel(right)));
  }, [activeProjectId, canAssignManagers, staffData]);

  const availableApprovers = useMemo(
    () => getApproverOptions(staffData, activeProjectId, form.approvalRole),
    [activeProjectId, form.approvalRole, staffData]
  );

  const tabs = useMemo(() => ([
    { key: "all", label: "All Tasks", items: taskGroups.tasks ?? [] },
    { key: "my", label: "My Tasks", items: taskGroups.assignedTasks ?? [] },
    { key: "approvals", label: "Pending Approvals", items: taskGroups.pendingApprovals ?? [] },
    { key: "approved", label: "Approved By Me", items: taskGroups.approvedByMe ?? [] },
  ]), [taskGroups]);

  const visibleTasks = useMemo(() => {
    const selectedTab = tabs.find((item) => item.key === tab)?.items ?? [];

    return [...selectedTab]
      .filter((task) => {
        if (!matchesStatusFilter(task, statusFilter, tab, currentUserId)) return false;
        if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
        if (roleBase !== "owner" && roleFilter !== "all" && !(task.assignments ?? []).some((assignment) => assignment.role === roleFilter)) {
          return false;
        }
        if (
          !matchesSearchQuery(
            deferredSearchQuery,
            task.title,
            task.description,
            task.project?.name,
            task.approver?.name,
            task.approver?.user_code,
            (task.assignments ?? []).map((assignment) => assignment.assignee?.name || assignment.assignee?.user_code),
            (task.assignments ?? []).map((assignment) => assignment.status)
          )
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "deadline") {
          const leftValue = left.end_date || "9999-12-31";
          const rightValue = right.end_date || "9999-12-31";
          return leftValue.localeCompare(rightValue);
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      })
      .map(buildDecoratedTask);
  }, [currentUserId, deferredSearchQuery, projectFilter, roleBase, roleFilter, sortBy, statusFilter, tab, tabs]);

  const resetForm = useCallback((nextProjectId = fixedProjectId || "") => {
    setForm(normalizeTaskForm(nextProjectId));
    setFormErrors({});
  }, [fixedProjectId]);

  const openCreate = useCallback(() => {
    setEditingTask(null);
    resetForm(fixedProjectId || "");
    setOpen(true);
  }, [fixedProjectId, resetForm]);

  const openEdit = useCallback((task) => {
    setEditingTask(task);
    setFormErrors({});
    setForm({
      id: task.id,
      projectId: task.project_id,
      assigneeUserIds: (task.assignments ?? []).map((assignment) => assignment.user_id),
      title: task.title ?? "",
      description: task.description ?? "",
      startDate: task.start_date ?? "",
      endDate: task.end_date ?? "",
      approvalRole: task.approval_role ?? "manager",
      approverUserId: task.approver_user_id ?? "",
    });
    setOpen(true);
  }, []);

  const toggleAssignee = useCallback((userId) => {
    setForm((prev) => ({
      ...prev,
      assigneeUserIds: prev.assigneeUserIds.includes(userId)
        ? prev.assigneeUserIds.filter((value) => value !== userId)
        : [...prev.assigneeUserIds, userId],
    }));
  }, []);

  async function saveTask(event) {
    event.preventDefault();
    if (saveBusy) return;

    const nextErrors = validateTaskForm(form, fixedProjectId);
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      scrollToField(Object.keys(nextErrors)[0]);
      return;
    }

    setError("");
    setMessage("");
    setSaveBusy(true);

    const payload = {
      ...form,
      projectId: activeProjectId,
      title: form.title.trim(),
      description: form.description.trim(),
    };

    try {
      await persistTask({
        payload,
        isEditing: Boolean(editingTask),
        includeStaff: true,
      });

      setMessage(editingTask ? "Task updated." : "Task created.");
      setOpen(false);
    } catch (requestError) {
      setError(requestError.message || "task_save_failed");
    } finally {
      setSaveBusy(false);
    }
  }

  const requestDelete = useCallback((task) => {
    setDialogState({
      open: true,
      title: "Delete Task",
      message: `Delete task "${task.title}"? This action cannot be undone.`,
      tone: "danger",
      onConfirm: async () => {
        if (deleteTaskId) return;
        setError("");
        setMessage("");
        setDeleteTaskId(task.id);
        try {
          await removeTask({ id: task.id });

          setMessage(`${task.title} deleted.`);
          setDeleteTaskId("");
          setDialogState((current) => ({ ...current, open: false }));
        } catch (requestError) {
          setError(requestError.message || "task_delete_failed");
          setDeleteTaskId("");
          setDialogState((current) => ({ ...current, open: false }));
        }
      },
    });
  }, [deleteTaskId, removeTask]);

  const openSubmit = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    setSubmitErrors({});
    setSubmitForm({
      workDescription: "",
      files: [],
      blocker: "",
    });
    setSubmitOpen(true);
  }, []);

  async function handleFileInput(files) {
    const nextFiles = await Promise.all(Array.from(files).map((file) => readFileAsDataUrl(file)));
    setSubmitForm((prev) => ({ ...prev, files: nextFiles }));
  }

  async function submitTask(event) {
    event.preventDefault();
    if (!selectedAssignment || submitBusy) return;

    const nextErrors = validateSubmissionForm(submitForm);
    if (Object.keys(nextErrors).length) {
      setSubmitErrors(nextErrors);
      scrollToField(Object.keys(nextErrors)[0]);
      return;
    }

    setError("");
    setMessage("");
    setSubmitBusy(true);

    try {
      await submitTaskWork({
        taskAssignmentId: selectedAssignment.id,
        workDescription: submitForm.workDescription.trim(),
        files: submitForm.files,
        blocker: submitForm.blocker.trim() || null,
      });

      setMessage(selectedAssignment.status === "rejected" ? "Task resubmitted." : "Task submitted.");
      setSubmitOpen(false);
    } catch (requestError) {
      setError(requestError.message || "task_submission_failed");
    } finally {
      setSubmitBusy(false);
    }
  }

  const openReview = useCallback((task, assignment) => {
    setSelectedTask(task);
    setSelectedAssignment(assignment);
    setReviewForm({ action: "approved", comment: "" });
    setReviewErrors({});
    setReviewOpen(true);
  }, []);

  async function submitReview(event) {
    event.preventDefault();
    if (!selectedAssignment || reviewBusy) return;

    const nextErrors = validateReviewForm(reviewForm);
    if (Object.keys(nextErrors).length) {
      setReviewErrors(nextErrors);
      scrollToField(Object.keys(nextErrors)[0]);
      return;
    }

    setError("");
    setMessage("");
    setReviewBusy(true);

    try {
      await reviewTaskSubmission({
        taskAssignmentId: selectedAssignment.id,
        action: reviewForm.action,
        comment: reviewForm.comment.trim() || null,
      });

      setMessage(reviewForm.action === "approved" ? "Task approved." : "Task rejected.");
      setSelectedTask(null);
      setSelectedAssignment(null);
      setReviewOpen(false);
    } catch (requestError) {
      setError(requestError.message || "task_review_failed");
    } finally {
      setReviewBusy(false);
    }
  }

  const reviewFiles = normalizeSubmissionFiles(selectedAssignment?.latest_submission);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xl font-bold text-[color:var(--acm-fg)]">Tasks</div>
        {canCreateTask ? (
          <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
            Assign Task
          </button>
        ) : null}
      </div>

      <TaskBoardControls
        tabs={tabs}
        tab={tab}
        searchQuery={searchQuery}
        sortBy={sortBy}
        statusFilter={statusFilter}
        roleBase={roleBase}
        roleFilter={roleFilter}
        projectFilter={projectFilter}
        fixedProjectId={fixedProjectId}
        projectList={projectList}
        onSearchChange={updateSearchQuery}
        onTabChange={updateTab}
        onSortChange={updateSortBy}
        onStatusFilterChange={updateStatusFilter}
        onRoleFilterChange={updateRoleFilter}
        onProjectFilterChange={updateProjectFilter}
      />

      <InlineMessage error={tasks.error || error} message={message} />

      <TaskListSection
        tasksLoading={tasks.loading}
        visibleTasks={visibleTasks}
        canCreateTask={canCreateTask}
        roleBase={roleBase}
        currentUserId={currentUserId}
        deleteTaskId={deleteTaskId}
        onOpenTask={setSelectedTask}
        onEditTask={openEdit}
        onDeleteTask={requestDelete}
        onSubmitAssignment={openSubmit}
        onReviewAssignment={openReview}
      />

      <ProfileModal
        open={Boolean(selectedTask) && !reviewOpen}
        title="Task Profile"
        details={selectedTask ? buildTaskDetails(selectedTask) : []}
        onClose={() => setSelectedTask(null)}
      />

      <Modal open={open} title={editingTask ? "Edit Task" : "Assign Task"} onClose={() => setOpen(false)} maxWidth="max-w-3xl">
        <form onSubmit={saveTask} className="grid gap-4">
          <FieldGroup title="Task Details">
            {!fixedProjectId ? (
              <LabeledField label="Project Name" fieldName="projectId" error={formErrors.projectId}>
                <select
                  className={fieldClass(Boolean(formErrors.projectId))}
                  value={activeProjectId}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}
                >
                  <option value="">Select Project</option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name ?? "-"}
                    </option>
                  ))}
                </select>
              </LabeledField>
            ) : (
              <LabeledField label="Project Name" fieldName="projectId">
                <input className={fieldClass()} value={availableProjects[0]?.name ?? "-"} readOnly />
              </LabeledField>
            )}

            <LabeledField label="Title" fieldName="title" error={formErrors.title}>
              <input className={fieldClass(Boolean(formErrors.title))} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </LabeledField>

            <LabeledField label="Description" fieldName="description">
              <textarea className={fieldClass()} rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </LabeledField>

            <div className="grid gap-3 md:grid-cols-2">
              <LabeledField label="Start Date" fieldName="startDate" error={formErrors.startDate}>
                <input className={fieldClass(Boolean(formErrors.startDate))} type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              </LabeledField>
              <LabeledField label="End Date" fieldName="endDate" error={formErrors.endDate}>
                <input className={fieldClass(Boolean(formErrors.endDate))} type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </LabeledField>
            </div>
          </FieldGroup>

          <FieldGroup title="Assignment">
            <LabeledField label="Approving Person Type" fieldName="approvalRole" error={formErrors.approvalRole}>
              <select
                className={fieldClass(Boolean(formErrors.approvalRole))}
                value={form.approvalRole}
                onChange={(e) => setForm((prev) => ({ ...prev, approvalRole: e.target.value, approverUserId: "" }))}
              >
                <option value="manager">Manager Approval</option>
                <option value="employee">Employee Approval</option>
              </select>
            </LabeledField>

            <LabeledField label="Approving Person" fieldName="approverUserId" error={formErrors.approverUserId}>
              <select
                className={fieldClass(Boolean(formErrors.approverUserId))}
                value={form.approverUserId}
                onChange={(e) => setForm((prev) => ({ ...prev, approverUserId: e.target.value }))}
              >
                <option value="">Select Approving Person</option>
                {availableApprovers.map((item) => (
                  <option key={item.user_id} value={item.user_id}>
                    {getTaskAssigneeLabel(item, activeProjectId)}
                  </option>
                ))}
              </select>
            </LabeledField>

            <div data-task-field="assigneeUserIds">
              <UserSelector
                users={availableAssignees}
                selectedUserIds={form.assigneeUserIds}
                onToggle={toggleAssignee}
                getLabel={(item) => getTaskAssigneeLabel(item, activeProjectId)}
                error={formErrors.assigneeUserIds}
              />
            </div>
          </FieldGroup>

          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => resetForm(activeProjectId)} className="acm-btn acm-btn-secondary h-10 px-4">
              Reset Form
            </button>
            <BusyButton type="submit" busy={saveBusy} className="acm-btn acm-btn-primary h-10 px-5">
              {editingTask ? "Save Changes" : "Create Task"}
            </BusyButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={submitOpen}
        title="Submit Task"
        onClose={() => {
          setSubmitOpen(false);
          setSelectedAssignment(null);
        }}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={submitTask} className="grid gap-4">
          <LabeledField label="Work Description" fieldName="workDescription" error={submitErrors.workDescription}>
            <textarea
              className={fieldClass(Boolean(submitErrors.workDescription))}
              rows={4}
              value={submitForm.workDescription}
              onChange={(e) => setSubmitForm((prev) => ({ ...prev, workDescription: e.target.value }))}
            />
          </LabeledField>

          <LabeledField label="Upload Files" fieldName="files">
            <input
              className={fieldClass()}
              type="file"
              multiple
              onChange={async (e) => {
                if (!e.target.files?.length) return;
                try {
                  await handleFileInput(e.target.files);
                } catch (err) {
                  setError(err.message || "file_read_failed");
                }
              }}
            />
          </LabeledField>

          <div className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3 text-sm text-[color:var(--acm-muted-fg)]">
            {submitForm.files.length ? `${submitForm.files.length} file(s) ready for upload` : "No files selected"}
          </div>

          <LabeledField label="Blocker" fieldName="blocker">
            <textarea className={fieldClass()} rows={3} value={submitForm.blocker} onChange={(e) => setSubmitForm((prev) => ({ ...prev, blocker: e.target.value }))} />
          </LabeledField>

          <BusyButton type="submit" busy={submitBusy} className="acm-btn acm-btn-primary h-10 px-5">
            {selectedAssignment?.status === "rejected" ? "Resubmit Task" : "Submit Task"}
          </BusyButton>
        </form>
      </Modal>

      <Modal
        open={reviewOpen}
        title="Task Review Page"
        onClose={() => {
          setReviewOpen(false);
          setSelectedTask(null);
          setSelectedAssignment(null);
        }}
        maxWidth="max-w-6xl"
      >
        <div className="grid gap-6">
          <TaskReviewPanel
            task={selectedTask}
            assignment={selectedAssignment}
            files={reviewFiles}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            approvalRoleLabel={selectedTask ? getApprovalRoleLabel(selectedTask.approval_role) : "-"}
          />

          <form onSubmit={submitReview} className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <LabeledField label="Decision" fieldName="action">
                <select className={fieldClass()} value={reviewForm.action} onChange={(e) => setReviewForm((prev) => ({ ...prev, action: e.target.value }))}>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </LabeledField>
              <LabeledField label="Remark" fieldName="comment" error={reviewErrors.comment}>
                <textarea
                  className={fieldClass(Boolean(reviewErrors.comment))}
                  rows={4}
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                />
              </LabeledField>
            </div>
            <div className="mt-4 flex justify-end">
              <BusyButton type="submit" busy={reviewBusy} className="acm-btn acm-btn-primary h-10 px-5">
                Save Review
              </BusyButton>
            </div>
          </form>
        </div>
      </Modal>

      <AppDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        tone={dialogState.tone}
        confirmLabel="Confirm"
        onClose={() => setDialogState({ open: false, title: "", message: "", onConfirm: null, tone: "default" })}
        onConfirm={dialogState.onConfirm}
        confirmBusy={Boolean(deleteTaskId)}
      />
    </>
  );
}
