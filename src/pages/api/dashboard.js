import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { getTaskWorkspace } from "@/lib/server/taskWorkflow";

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "GET") return sendError(res, 405, "method_not_allowed");

  const [{ data: projects }, { data: companyUsers }, { data: projectUsers }, taskWorkspace] = await Promise.all([
    ctx.admin
      .from("projects")
      .select("id, start_date, end_date")
      .eq("company_id", ctx.company.id),
    ctx.admin
      .from("company_users")
      .select("user_id, role")
      .eq("company_id", ctx.company.id),
    ctx.admin
      .from("project_users")
      .select("project_id, user_id, role"),
    getTaskWorkspace(ctx.admin, ctx),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visibleProjects = (projects ?? []).filter((project) => {
    if (ctx.role === "owner") return true;
    return ctx.projectIds.includes(project.id);
  });

  const visibleTasks = taskWorkspace.tasks ?? [];
  const visibleAssignments = visibleTasks.flatMap((task) => task.assignments ?? []);
  const myAssignments = visibleAssignments.filter((assignment) => assignment.user_id === ctx.user.id);
  const submittedForMyRole = visibleTasks.flatMap((task) =>
    task.approval_role === ctx.role && (!task.approver_user_id || task.approver_user_id === ctx.user.id)
      ? (task.assignments ?? []).filter(
          (assignment) => assignment.status === "submitted" && assignment.user_id !== ctx.user.id
        )
      : []
  );
  const approvalsByMe = visibleAssignments.filter(
    (assignment) => assignment.latest_approval?.approved_by_user_id === ctx.user.id
  );
  const tasksAssignedByMe = visibleAssignments.filter(
    (assignment) => assignment.assigned_by_user_id === ctx.user.id
  );

  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const visibleStaffUserIds = new Set(
    ctx.role === "owner"
      ? (companyUsers ?? []).map((item) => item.user_id)
      : (projectUsers ?? [])
          .filter((assignment) => visibleProjectIds.has(assignment.project_id))
          .map((assignment) => assignment.user_id)
  );

  const visibleCompanyUsers =
    ctx.role === "owner"
      ? companyUsers ?? []
      : (companyUsers ?? []).filter((item) => visibleStaffUserIds.has(item.user_id));

  const managerCount = visibleCompanyUsers.filter((item) => item.role === "manager").length;
  const employeeCount = visibleCompanyUsers.filter((item) => item.role === "employee").length;

  const projectSummary = {
    total: visibleProjects.length,
    live: visibleProjects.filter((item) => {
      const start = item.start_date ? new Date(item.start_date) : null;
      const end = item.end_date ? new Date(item.end_date) : null;
      return (!start || start <= today) && (!end || end >= today);
    }).length,
    complete: visibleProjects.filter((item) => {
      const end = item.end_date ? new Date(item.end_date) : null;
      return Boolean(end && end < today);
    }).length,
    onhold: visibleProjects.filter((item) => {
      const start = item.start_date ? new Date(item.start_date) : null;
      return Boolean(start && start > today);
    }).length,
  };

  const summary = {
    projects: projectSummary,
    staff: {
      managers: managerCount,
      employees: employeeCount,
    },
    tasks:
      ctx.role === "owner"
        ? {
            todayAssigned: visibleAssignments.filter((item) => {
              const createdAt = new Date(item.created_at);
              createdAt.setHours(0, 0, 0, 0);
              return createdAt.getTime() === today.getTime();
            }).length,
            completed: visibleAssignments.filter((item) => item.status === "approved").length,
          }
        : {
            myTasks: {
              total: myAssignments.length,
              completed: myAssignments.filter((item) => item.status === "approved").length,
            },
            approvingTasks: {
              approved: approvalsByMe.length,
              toBeApproved: submittedForMyRole.length,
            },
            assignedTasks:
              ctx.role === "manager"
                ? {
                    assigned: tasksAssignedByMe.filter((item) => item.status === "assigned").length,
                    completed: tasksAssignedByMe.filter((item) => item.status === "approved").length,
                  }
                : null,
          },
  };

  return sendOk(res, {
    role: ctx.role,
    company: ctx.company,
    viewer: ctx.viewer,
    summary,
  });
}
