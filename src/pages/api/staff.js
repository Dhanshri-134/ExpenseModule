import { z } from "zod";
import { canCreateStaff, getRequestContext } from "@/lib/server/authz";
import { upsertDemoCredential, readDemoCredentials } from "@/lib/server/demoCredentials";
import { sendError, sendOk } from "@/lib/server/responses";
import { getAuthUsersMap, invalidateAuthUsersCache } from "@/lib/server/authUsers";
import { createAuthUser } from "@/lib/server/users";
import { insertActivityLog } from "@/lib/server/taskWorkflow";

const CreateStaffSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["manager", "employee"]),
  email: z.string().email(),
  mobile: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().default(0),
  projectId: z.string().uuid().optional().nullable(),
});

const UpdateStaffSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().default(0),
});

const DeleteStaffSchema = z.object({
  userId: z.string().uuid(),
});

async function canManageExistingStaff(ctx, targetUserId) {
  const { data: targetMembership } = await ctx.admin
    .from("company_users")
    .select("user_id, role")
    .eq("company_id", ctx.company.id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetMembership) return false;
  if (ctx.role === "owner") return targetMembership.role !== "owner";
  if (ctx.role !== "manager") return false;
  if (targetMembership.role !== "employee") return false;

  const managedProjectIds = ctx.projectAssignments
    .filter((item) => item.role === "manager")
    .map((item) => item.project_id);

  if (!managedProjectIds.length) return false;

  const { data: targetAssignments } = await ctx.admin
    .from("project_users")
    .select("project_id, role")
    .eq("user_id", targetUserId)
    .in("project_id", managedProjectIds);

  return (targetAssignments ?? []).some((item) => item.role === "employee");
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const { data: companyUsers, error } = await ctx.admin
      .from("company_users")
      .select("company_id, user_id, role, user_code, mobile_no, hourly_rate, created_in_project_id, person_id, created_at")
      .eq("company_id", ctx.company.id)
      .neq("role", "owner")
      .order("role", { ascending: true })
      .order("role_number", { ascending: true });

    if (error) return sendError(res, 500, "staff_fetch_failed");

    let filtered = companyUsers ?? [];
    if (ctx.role === "manager") {
      const employeeIds = new Set();
      const managedProjectIds = ctx.projectAssignments
        .filter((item) => item.role === "manager")
        .map((item) => item.project_id);

      if (managedProjectIds.length) {
        const { data: scopedAssignments } = await ctx.admin
          .from("project_users")
          .select("user_id, role, project_id")
          .in("project_id", managedProjectIds);

        (scopedAssignments ?? [])
          .filter((item) => item.role === "employee")
          .forEach((item) => employeeIds.add(item.user_id));
      }

      filtered = filtered.filter((item) => item.user_id === ctx.user.id || employeeIds.has(item.user_id));
    } else if (ctx.role === "employee") {
      filtered = filtered.filter((item) => item.user_id === ctx.user.id);
    }

    const personIds = [...new Set(filtered.map((item) => item.person_id).filter(Boolean))];
    const userIds = filtered.map((item) => item.user_id);

    const [{ data: people }, authUsersById] = await Promise.all([
      personIds.length
        ? ctx.admin
            .from("people")
            .select("id, name, email, contact, address")
            .in("id", personIds)
        : Promise.resolve({ data: [] }),
      getAuthUsersMap(ctx.admin),
    ]);

    const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
    const credentials = readDemoCredentials();
    const credentialsByUserId = new Map(credentials.map((entry) => [entry.userId, entry]));
    const projectsById = {};
    const projectAssignmentsByUserId = {};
    if (filtered.some((item) => item.created_in_project_id)) {
      const projectIds = [...new Set(filtered.map((item) => item.created_in_project_id).filter(Boolean))];
      const { data: projects } = await ctx.admin
        .from("projects")
        .select("id, name, job_number")
        .in("id", projectIds);
      (projects ?? []).forEach((project) => {
        projectsById[project.id] = project;
      });
    }

    if (userIds.length) {
      const { data: projectAssignments } = await ctx.admin
        .from("project_users")
        .select("project_id, user_id, role")
        .in("user_id", userIds);

      (projectAssignments ?? []).forEach((assignment) => {
        if (!projectAssignmentsByUserId[assignment.user_id]) {
          projectAssignmentsByUserId[assignment.user_id] = [];
        }
        projectAssignmentsByUserId[assignment.user_id].push(assignment);
      });

      const allProjectIds = [
        ...new Set((projectAssignments ?? []).map((item) => item.project_id).filter(Boolean)),
        ...Object.keys(projectsById),
      ];

      if (allProjectIds.length) {
        const { data: projects } = await ctx.admin
          .from("projects")
          .select("id, name, job_number")
          .in("id", allProjectIds);
        (projects ?? []).forEach((project) => {
          projectsById[project.id] = project;
        });
      }
    }

    const enriched = filtered.map((item) => {
      const person = item.person_id ? peopleById.get(item.person_id) || null : null;
      const credential = credentialsByUserId.get(item.user_id) || null;
      const authUser = authUsersById.get(item.user_id) || null;
      return {
        ...item,
        name: person?.name || authUser?.user_metadata?.full_name || item.user_code,
        email: credential?.email || person?.email || authUser?.email || "",
        mobile: item.mobile_no || person?.contact || "",
        address: person?.address || "",
        password: ctx.role === "owner" ? credential?.password || "" : "",
        password_sent_at: credential?.password_sent_at || null,
        created_project: item.created_in_project_id ? projectsById[item.created_in_project_id] || null : null,
        project_assignments: (projectAssignmentsByUserId[item.user_id] ?? []).map((assignment) => ({
          ...assignment,
          project: projectsById[assignment.project_id] || null,
        })),
      };
    });

    return sendOk(res, {
      staff: {
        managers: enriched.filter((item) => item.role === "manager"),
        employees: enriched.filter((item) => item.role === "employee"),
      },
    });
  }

  if (req.method === "POST") {
    const parsed = CreateStaffSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    if (!canCreateStaff(ctx, payload.role, payload.projectId ?? null)) {
      return sendError(res, 403, "forbidden");
    }

    if (ctx.role === "manager" && payload.role !== "employee") {
      return sendError(res, 403, "manager_can_only_create_employee");
    }

    const { user, temporaryPassword } = await createAuthUser(ctx.admin, {
      email: payload.email,
      name: payload.name,
      mobile: payload.mobile,
    });
    invalidateAuthUsersCache();

    const { data: membership, error: membershipError } = await ctx.admin
      .from("company_users")
      .insert({
        company_id: ctx.company.id,
        user_id: user.id,
        role: payload.role,
        mobile_no: payload.mobile ?? "",
        hourly_rate: payload.hourlyRate,
        created_by_user_id: ctx.user.id,
        created_in_project_id: payload.projectId ?? null,
      })
      .select("company_id, user_id, role, user_code, hourly_rate, created_in_project_id")
      .single();

    if (membershipError || !membership) return sendError(res, 500, "staff_membership_create_failed", membershipError?.message);

    if (payload.projectId) {
      const assignmentRole = payload.role === "manager" ? "manager" : "employee";
      const { error: assignmentError } = await ctx.admin
        .from("project_users")
        .insert({
          project_id: payload.projectId,
          user_id: user.id,
          role: assignmentRole,
          hourly_rate: payload.hourlyRate,
        });

      if (assignmentError) return sendError(res, 500, "project_assignment_failed", assignmentError.message);
    }

    await insertActivityLog(ctx.admin, {
      company_id: ctx.company.id,
      project_id: payload.projectId ?? null,
      actor_user_id: ctx.user.id,
      message: `${payload.name} created as ${payload.role}`,
      metadata: {
        type: "staff_create",
        user_id: user.id,
        role: payload.role,
        hourly_rate: payload.hourlyRate,
        project_id: payload.projectId ?? null,
      },
    });

    upsertDemoCredential({
      userId: user.id,
      companyId: ctx.company.id,
      email: payload.email,
      password: temporaryPassword,
      userCode: membership.user_code,
      password_sent_at: null,
    });

    return sendOk(res, {
      staff: membership,
      auth: {
        email: payload.email,
        temporaryPassword,
      },
    });
  }

  if (req.method === "PUT") {
    const parsed = UpdateStaffSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    const allowed = await canManageExistingStaff(ctx, payload.userId);
    if (!allowed) return sendError(res, 403, "forbidden");

    const { error: authError } = await ctx.admin.auth.admin.updateUserById(payload.userId, {
      email: payload.email,
      user_metadata: {
        full_name: payload.name,
        name: payload.name,
        mobile: payload.mobile ?? "",
      },
    });

    if (authError) return sendError(res, 500, "staff_auth_update_failed", authError.message);
    invalidateAuthUsersCache();

    const { error: membershipError } = await ctx.admin
      .from("company_users")
      .update({
        mobile_no: payload.mobile ?? "",
        hourly_rate: payload.hourlyRate,
      })
      .eq("company_id", ctx.company.id)
      .eq("user_id", payload.userId);

    if (membershipError) return sendError(res, 500, "staff_update_failed", membershipError.message);

    await insertActivityLog(ctx.admin, {
      company_id: ctx.company.id,
      actor_user_id: ctx.user.id,
      message: `${payload.name} profile updated`,
      metadata: {
        type: "staff_update",
        user_id: payload.userId,
        hourly_rate: payload.hourlyRate,
        mobile: payload.mobile ?? "",
      },
    });

    return sendOk(res, { updated: true });
  }

  if (req.method === "DELETE") {
    const parsed = DeleteStaffSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const allowed = await canManageExistingStaff(ctx, parsed.data.userId);
    if (!allowed) return sendError(res, 403, "forbidden");

    const { data: deletingStaff } = await ctx.admin
      .from("company_users")
      .select("user_id, user_code, role")
      .eq("company_id", ctx.company.id)
      .eq("user_id", parsed.data.userId)
      .maybeSingle();

    const { error } = await ctx.admin.auth.admin.deleteUser(parsed.data.userId);
    if (error) return sendError(res, 500, "staff_delete_failed", error.message);
    invalidateAuthUsersCache();

    await insertActivityLog(ctx.admin, {
      company_id: ctx.company.id,
      actor_user_id: ctx.user.id,
      message: `${deletingStaff?.user_code || "Staff"} deleted`,
      metadata: {
        type: "staff_delete",
        user_id: parsed.data.userId,
        role: deletingStaff?.role || null,
      },
    });

    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
