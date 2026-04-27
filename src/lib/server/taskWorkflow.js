import { ROLE_LABELS } from "@/lib/roles";

export const PROJECT_ASSIGNABLE_ROLES = ["manager", "employee"];
export const TASK_ASSIGNMENT_STATUSES = ["assigned", "submitted", "approved", "rejected"];

export function normalizeProjectRole(role) {
  return PROJECT_ASSIGNABLE_ROLES.includes(role) ? role : "employee";
}

export function formatRoleLabel(role) {
  const normalized = normalizeProjectRole(role);
  return ROLE_LABELS[normalized] ?? normalized;
}

export function canManageTasks(ctx, projectId) {
  if (ctx.role === "owner") return true;
  return ctx.role === "manager" && ctx.projectIds.includes(projectId);
}

export function canApproveTask(ctx, task) {
  return (
    (ctx.role === "manager" || ctx.role === "employee") &&
    ctx.role === task.approval_role &&
    (!task.approver_user_id || task.approver_user_id === ctx.user.id) &&
    ctx.projectIds.includes(task.project_id)
  );
}

export async function loadUserDirectory(admin, companyId, userIds) {
  const dedupedUserIds = [...new Set((userIds ?? []).filter(Boolean))];
  if (!dedupedUserIds.length) return new Map();

  const [{ data: memberships, error: membershipError }, authUsersResponse] = await Promise.all([
    admin
      .from("company_users")
      .select("user_id, role, user_code, person_id, mobile_no")
      .eq("company_id", companyId)
      .in("user_id", dedupedUserIds),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (membershipError) {
    throw new Error(membershipError.message || "membership_lookup_failed");
  }

  const membershipRows = memberships ?? [];
  const authUsers = authUsersResponse.data?.users ?? [];
  const authUsersById = new Map(authUsers.map((user) => [user.id, user]));
  const personIds = [...new Set(membershipRows.map((item) => item.person_id).filter(Boolean))];
  const { data: people, error: peopleError } = personIds.length
    ? await admin.from("people").select("id, name, email, contact, address").in("id", personIds)
    : { data: [], error: null };

  if (peopleError) {
    throw new Error(peopleError.message || "people_lookup_failed");
  }

  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  const directory = new Map();

  membershipRows.forEach((membership) => {
    const person = membership.person_id ? peopleById.get(membership.person_id) ?? null : null;
    const authUser = authUsersById.get(membership.user_id) ?? null;
    directory.set(membership.user_id, {
      user_id: membership.user_id,
      role: membership.role,
      user_code: membership.user_code,
      name:
        person?.name ||
        authUser?.user_metadata?.full_name ||
        authUser?.user_metadata?.name ||
        membership.user_code ||
        "User",
      email: person?.email || authUser?.email || "",
      mobile: membership.mobile_no || person?.contact || "",
      address: person?.address || "",
    });
  });

  return directory;
}

export async function loadProjectMap(admin, projectIds) {
  const dedupedProjectIds = [...new Set((projectIds ?? []).filter(Boolean))];
  if (!dedupedProjectIds.length) return new Map();

  const { data, error } = await admin
    .from("projects")
    .select("id, name, job_number")
    .in("id", dedupedProjectIds);

  if (error) {
    throw new Error(error.message || "project_lookup_failed");
  }

  return new Map((data ?? []).map((project) => [project.id, project]));
}

function buildAssignmentSubmissionState(assignment, submissions, approvals, directory) {
  const assignmentSubmissions = submissions
    .filter((item) => item.task_assignment_id === assignment.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestSubmission = assignmentSubmissions[0] ?? null;
  const latestApproval = latestSubmission
    ? approvals
        .filter((item) => item.task_submission_id === latestSubmission.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
    : null;

  return {
    ...assignment,
    assignee: directory.get(assignment.user_id) ?? null,
    latest_submission: latestSubmission
      ? {
          ...latestSubmission,
          submitted_by: directory.get(latestSubmission.submitted_by_user_id) ?? null,
        }
      : null,
    latest_approval: latestApproval
      ? {
          ...latestApproval,
          approved_by: directory.get(latestApproval.approved_by_user_id) ?? null,
        }
      : null,
  };
}

export async function getTaskWorkspace(admin, ctx, options = {}) {
  const projectId = options.projectId ?? null;

  let taskQuery = admin
    .from("tasks")
    .select("id, company_id, project_id, title, description, start_date, end_date, approval_role, approver_user_id, created_by, created_at, updated_at")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false });

  if (projectId) {
    taskQuery = taskQuery.eq("project_id", projectId);
  }

  const { data: taskRows, error: taskError } = await taskQuery;
  if (taskError) {
    throw new Error(taskError.message || "tasks_fetch_failed");
  }

  const visibleTasks = (taskRows ?? []).filter((task) => {
    if (ctx.role === "owner") return true;
    return ctx.projectIds.includes(task.project_id);
  });

  const taskIds = visibleTasks.map((task) => task.id);
  if (!taskIds.length) {
    return {
      tasks: [],
      assignedTasks: [],
      approvedByMe: [],
    };
  }

  const [{ data: assignments, error: assignmentError }, { data: submissions, error: submissionError }, { data: approvals, error: approvalError }] =
    await Promise.all([
      admin
        .from("task_assignments")
        .select("id, task_id, project_id, user_id, role, assigned_by_user_id, status, created_at, updated_at")
        .in("task_id", taskIds),
      admin
        .from("task_submissions")
        .select("id, task_assignment_id, task_id, project_id, submitted_by_user_id, work_description, photos, blocker, created_at")
        .in("task_id", taskIds),
      admin
        .from("task_approvals")
        .select("id, task_submission_id, task_assignment_id, task_id, project_id, action, comment, approved_by_user_id, approved_by_role, created_at")
        .in("task_id", taskIds),
    ]);

  if (assignmentError) throw new Error(assignmentError.message || "task_assignments_fetch_failed");
  if (submissionError) throw new Error(submissionError.message || "task_submissions_fetch_failed");
  if (approvalError) throw new Error(approvalError.message || "task_approvals_fetch_failed");

  const allUserIds = [
    ...new Set([
      ...visibleTasks.map((task) => task.created_by),
      ...visibleTasks.map((task) => task.approver_user_id),
      ...(assignments ?? []).flatMap((assignment) => [assignment.user_id, assignment.assigned_by_user_id]),
      ...(submissions ?? []).map((submission) => submission.submitted_by_user_id),
      ...(approvals ?? []).map((approval) => approval.approved_by_user_id),
    ].filter(Boolean)),
  ];

  const [directory, projectMap] = await Promise.all([
    loadUserDirectory(admin, ctx.company.id, allUserIds),
    loadProjectMap(admin, visibleTasks.map((task) => task.project_id)),
  ]);

  const tasks = visibleTasks.map((task) => {
    const taskAssignments = (assignments ?? [])
      .filter((assignment) => assignment.task_id === task.id)
      .map((assignment) =>
        buildAssignmentSubmissionState(assignment, submissions ?? [], approvals ?? [], directory)
      );

    const myAssignments = taskAssignments.filter((assignment) => assignment.user_id === ctx.user.id);
    const canApprove = canApproveTask(ctx, task);

    return {
      ...task,
      project: projectMap.get(task.project_id) ?? null,
      creator: directory.get(task.created_by) ?? null,
      approver: task.approver_user_id ? directory.get(task.approver_user_id) ?? null : null,
      assignments: taskAssignments,
      my_assignments: myAssignments,
      can_submit: myAssignments.some((assignment) =>
        ["assigned", "rejected"].includes(assignment.status)
      ),
      can_approve: canApprove,
    };
  });

  return {
    tasks,
    assignedTasks: tasks.filter((task) => task.my_assignments.length > 0),
    approvedByMe: tasks.filter((task) =>
      task.assignments.some((assignment) => assignment.latest_approval?.approved_by_user_id === ctx.user.id)
    ),
  };
}

export async function insertActivityLog(admin, entry) {
  const { error } = await admin.from("activity_logs").insert(entry);
  if (error) {
    throw new Error(error.message || "activity_log_failed");
  }
}
