import { z } from "zod";
import { canCreateStaff, getRequestContext } from "@/lib/server/authz";
import { updateDemoCredential, upsertDemoCredential, readDemoCredentials } from "@/lib/server/demoCredentials";
import { sendError, sendOk } from "@/lib/server/responses";
import { getAuthUsersMap, invalidateAuthUsersCache } from "@/lib/server/authUsers";
import { createAuthUser } from "@/lib/server/users";
import { insertActivityLog } from "@/lib/server/taskWorkflow";
import { MODULE_ACCESS_KEYS, normalizeModuleAccess } from "@/lib/moduleAccess";

const ModuleAccessSchema = z
  .object({
    leads: z.boolean().optional(),
    clients: z.boolean().optional(),
    projects: z.boolean().optional(),
    invoices: z.boolean().optional(),
    estimates: z.boolean().optional(),
  })
  .optional();

const CreateStaffSchema = z.object({
  name: z.string().min(1),
  userName: z.string().min(1).optional().nullable(),
  role: z.enum(["manager", "employee", "subcontractor"]),
  email: z.string().email(),
  mobile: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().default(0),
  craft: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  password: z.string().min(8).optional().nullable(),
  moduleAccess: ModuleAccessSchema,
});

const UpdateStaffSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
  userName: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().default(0),
  craft: z.string().optional().nullable(),
  password: z.string().min(8).optional().or(z.literal("")),
  moduleAccess: ModuleAccessSchema,
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

async function buildStaffPreview(ctx, role) {
  const resolvedRole = role === "manager" ? "manager" : role === "subcontractor" ? "subcontractor" : "employee";
  const { data: counter } = await ctx.admin
    .from("company_role_counters")
    .select("last_number")
    .eq("company_id", ctx.company.id)
    .eq("role", resolvedRole)
    .maybeSingle();

  const nextRoleNumber = Number(counter?.last_number || 0) + 1;
  const paddedNumber = String(nextRoleNumber).padStart(3, "0");
  const companyCode = ctx.company.code || "ACM";
  const creatorRoleNumber = ctx.membership?.role_number || null;

  const userCode =
    ctx.role === "manager" && resolvedRole === "employee" && creatorRoleNumber
      ? `${companyCode}-M${creatorRoleNumber}-E-${paddedNumber}`
      : resolvedRole === "manager"
        ? `${companyCode}-M-${paddedNumber}`
        : `${companyCode}-E-${paddedNumber}`;

  return {
    userCode,
    temporaryPassword: "Shris@xxxxxxxx9",
  };
}

async function loadModuleAccessByUserId(admin, companyId, userIds, roleByUserId = new Map()) {
  const results = new Map();
  userIds.forEach((userId) => {
    results.set(userId, normalizeModuleAccess({}, roleByUserId.get(userId) || "employee"));
  });

  if (!userIds.length) return results;

  const { data } = await admin
    .from("company_user_module_access")
    .select("user_id, module_key, granted")
    .eq("company_id", companyId)
    .in("user_id", userIds);

  (data ?? []).forEach((item) => {
    const current = results.get(item.user_id) || {};
    current[item.module_key] = Boolean(item.granted);
    results.set(item.user_id, current);
  });

  userIds.forEach((userId) => {
    results.set(userId, normalizeModuleAccess(results.get(userId), roleByUserId.get(userId) || "employee"));
  });

  return results;
}

async function saveModuleAccess(admin, companyId, userId, role, moduleAccess, actorUserId = null) {
  const normalized = normalizeModuleAccess(moduleAccess, role);
  const rows = MODULE_ACCESS_KEYS.map((moduleKey) => ({
    company_id: companyId,
    user_id: userId,
    module_key: moduleKey,
    granted: normalized[moduleKey],
    updated_by_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin.from("company_user_module_access").upsert(rows, {
    onConflict: "company_id,user_id,module_key",
  });

  if (error) throw new Error(error.message || "module_access_save_failed");
  return normalized;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    if (req.query.mode === "preview") {
      const previewRole = String(req.query.role || "employee");
      const preview = await buildStaffPreview(ctx, previewRole);
      return sendOk(res, { preview });
    }

    const { data: companyUsers, error } = await ctx.admin
      .from("company_users")
      .select("company_id, user_id, role, user_code, user_name, mobile_no, hourly_rate, craft, created_in_project_id, person_id, created_at")
      .eq("company_id", ctx.company.id)
      .neq("role", "owner")
      .order("role", { ascending: true })
      .order("role_number", { ascending: true });

    if (error) return sendError(res, 500, "staff_fetch_failed");

    let filtered = companyUsers ?? [];
    if (ctx.role === "manager") {
      const visibleUserIds = new Set([ctx.user.id]);
      const managedProjectIds = ctx.projectAssignments
        .filter((item) => item.role === "manager")
        .map((item) => item.project_id);

      if (managedProjectIds.length) {
        const { data: scopedAssignments } = await ctx.admin
          .from("project_users")
          .select("user_id, role, project_id")
          .in("project_id", managedProjectIds);

        (scopedAssignments ?? [])
          .filter((item) => item.role === "employee" || item.role === "subcontractor")
          .forEach((item) => visibleUserIds.add(item.user_id));
      }

      filtered = filtered.filter((item) => visibleUserIds.has(item.user_id));
    } else if (ctx.role === "employee") {
      filtered = filtered.filter((item) => item.user_id === ctx.user.id);
    }

    const personIds = [...new Set(filtered.map((item) => item.person_id).filter(Boolean))];
    const userIds = filtered.map((item) => item.user_id);
    const roleByUserId = new Map(filtered.map((item) => [item.user_id, item.role]));

    const [{ data: people }, authUsersById, moduleAccessByUserId] = await Promise.all([
      personIds.length
        ? ctx.admin
            .from("people")
            .select("id, name, email, contact, address")
            .in("id", personIds)
        : Promise.resolve({ data: [] }),
      getAuthUsersMap(ctx.admin),
      loadModuleAccessByUserId(ctx.admin, ctx.company.id, userIds, roleByUserId),
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
        user_name: item.user_name || authUser?.user_metadata?.user_name || item.user_code,
        email: credential?.email || person?.email || authUser?.email || "",
        mobile: item.mobile_no || person?.contact || "",
        craft: item.craft || "",
        address: person?.address || "",
        password: ctx.role === "employee" ? "" : credential?.password || "",
        password_sent_at: credential?.password_sent_at || null,
        module_access: moduleAccessByUserId.get(item.user_id) || normalizeModuleAccess({}, item.role),
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
        subcontractors: enriched.filter((item) => item.role === "subcontractor"),
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
      userName: payload.userName?.trim() || undefined,
      mobile: payload.mobile,
      password: payload.password || undefined,
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
        craft: payload.craft ?? "",
        created_by_user_id: ctx.user.id,
        created_in_project_id: payload.projectId ?? null,
        user_name: payload.userName?.trim() || null,
      })
      .select("company_id, user_id, role, user_code, user_name, hourly_rate, created_in_project_id")
      .single();

    if (membershipError || !membership) return sendError(res, 500, "staff_membership_create_failed", membershipError?.message);

    if (payload.projectId) {
      const assignmentRole = payload.role === "manager" ? "manager" : payload.role === "subcontractor" ? "subcontractor" : "employee";
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

    const savedModuleAccess = await saveModuleAccess(
      ctx.admin,
      ctx.company.id,
      user.id,
      payload.role,
      payload.moduleAccess,
      ctx.user.id
    );

    const finalUserName = membership.user_name || membership.user_code;
    if (finalUserName !== (payload.userName?.trim() || "")) {
      const { error: usernameError } = await ctx.admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          user_name: finalUserName,
        },
      });

      if (usernameError) {
        return sendError(res, 500, "staff_username_sync_failed", usernameError.message);
      }
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
        module_access: savedModuleAccess,
      },
    });

    upsertDemoCredential({
      userId: user.id,
      companyId: ctx.company.id,
      email: payload.email,
      password: temporaryPassword,
      userCode: membership.user_code,
      userName: finalUserName,
      password_sent_at: null,
    });

    return sendOk(res, {
      staff: membership,
      auth: {
        email: payload.email,
        userName: finalUserName,
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
      ...(payload.password ? { password: payload.password, email_confirm: true } : {}),
      user_metadata: {
        full_name: payload.name,
        name: payload.name,
        user_name: payload.userName.trim(),
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
        craft: payload.craft ?? "",
        user_name: payload.userName.trim(),
      })
      .eq("company_id", ctx.company.id)
      .eq("user_id", payload.userId);

    if (membershipError) return sendError(res, 500, "staff_update_failed", membershipError.message);

    const { data: targetMembership } = await ctx.admin
      .from("company_users")
      .select("role")
      .eq("company_id", ctx.company.id)
      .eq("user_id", payload.userId)
      .maybeSingle();

    const savedModuleAccess = await saveModuleAccess(
      ctx.admin,
      ctx.company.id,
      payload.userId,
      targetMembership?.role || "employee",
      payload.moduleAccess,
      ctx.user.id
    );

    updateDemoCredential(payload.userId, {
      email: payload.email,
      userName: payload.userName.trim(),
      ...(payload.password ? { password: payload.password } : {}),
    });

    await insertActivityLog(ctx.admin, {
      company_id: ctx.company.id,
      actor_user_id: ctx.user.id,
      message: `${payload.name} profile updated`,
      metadata: {
        type: "staff_update",
        user_id: payload.userId,
        user_name: payload.userName.trim(),
        hourly_rate: payload.hourlyRate,
        mobile: payload.mobile ?? "",
        craft: payload.craft ?? "",
        module_access: savedModuleAccess,
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
