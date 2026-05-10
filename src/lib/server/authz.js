import { createSupabasePagesServerClient } from "@/lib/pages/supabaseServerClient";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDashboardViewer } from "@/lib/dashboard";
import { extractCompanyAssetMetadata } from "@/lib/server/companyAssets";
import { buildDefaultModuleAccess, canUseModule, normalizeModuleAccess } from "@/lib/moduleAccess";

async function loadModuleAccess(admin, companyId, userId, role) {
  if (role === "owner") return buildDefaultModuleAccess(role);

  const { data, error } = await admin
    .from("company_user_module_access")
    .select("module_key, granted")
    .eq("company_id", companyId)
    .eq("user_id", userId);

  if (error) return buildDefaultModuleAccess(role);

  const mapped = {};
  (data ?? []).forEach((item) => {
    mapped[item.module_key] = Boolean(item.granted);
  });
  return normalizeModuleAccess(mapped, role);
}

export async function getRequestContext(req, res) {
  const supabase = createSupabasePagesServerClient(req, res);
  const admin = getSupabaseAdminClient();

  if (!supabase || !admin) {
    return { ok: false, status: 500, error: "supabase_not_configured" };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }

  const user = userData.user;

  const { data: memberships, error: membershipError } = await admin
    .from("company_users")
    .select("company_id, role, user_code, user_name, role_number, mobile_no, hourly_rate, created_in_project_id")
    .eq("user_id", user.id);

  if (membershipError || !memberships?.length) {
    return { ok: false, status: 403, error: "membership_not_found" };
  }

  const membership = memberships[0];

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name, code, metadata")
    .eq("id", membership.company_id)
    .maybeSingle();

  if (companyError || !company) {
    return { ok: false, status: 403, error: "company_not_found" };
  }

  const companyMetadata = extractCompanyAssetMetadata(admin, company?.metadata);

  const { data: projectAssignments, error: assignmentError } = await admin
    .from("project_users")
    .select("project_id, role, hourly_rate")
    .eq("user_id", user.id);

  if (assignmentError) {
    return { ok: false, status: 500, error: "assignment_lookup_failed" };
  }

  const role = membership.role;
  const moduleAccess = await loadModuleAccess(admin, membership.company_id, user.id, role);
  const projectIds = [
    ...new Set(
      [
        ...(projectAssignments ?? []).map((item) => item.project_id),
        membership.created_in_project_id,
      ].filter(Boolean)
    ),
  ];

  return {
    ok: true,
    supabase,
    admin,
    user,
    membership,
    company,
    role,
    moduleAccess,
    projectAssignments: projectAssignments ?? [],
    projectIds,
    viewer: buildDashboardViewer({
      id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0],
      email: user.email ?? "",
      userName: membership.user_name || user.user_metadata?.user_name || membership.user_code,
      userCode: membership.user_code || "",
      role,
      moduleAccess,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      companyName: company.name,
      companyLogoUrl: companyMetadata.logoUrl || "",
    }),
  };
}

export function hasRole(ctx, allowedRoles) {
  return allowedRoles.includes(ctx.role);
}

export function canAccessProject(ctx, projectId) {
  if (ctx.role === "owner") return true;
  return ctx.projectIds.includes(projectId);
}

export function canAccessModule(ctx, moduleKey) {
  if (ctx.role === "owner") return true;
  return canUseModule(ctx.moduleAccess, moduleKey);
}

export function canAssignTask(ctx, targetRole, projectId) {
  if (ctx.role === "owner") return targetRole === "manager" || targetRole === "employee" || targetRole === "subcontractor";
  if (ctx.role === "manager") return (targetRole === "employee" || targetRole === "subcontractor") && canAccessProject(ctx, projectId);
  return false;
}

export function canCreateStaff(ctx, nextRole, projectId = null) {
  if (ctx.role === "owner") return nextRole === "manager" || nextRole === "employee" || nextRole === "subcontractor";
  if (ctx.role === "manager") {
    return nextRole === "employee" && Boolean(projectId) && canAccessProject(ctx, projectId);
  }
  return false;
}

export async function requirePageRole(ctx, allowedRoles) {
  const reqCtx = await getRequestContext(ctx.req, ctx.res);
  if (!reqCtx.ok) {
    if (reqCtx.status === 401) {
      return { redirect: { destination: "/", permanent: false } };
    }

    const preferredRole = allowedRoles?.[0];
    return {
      redirect: {
        destination: preferredRole ? `/login/${preferredRole}` : "/",
        permanent: false,
      },
    };
  }

  if (!hasRole(reqCtx, allowedRoles)) {
    return { redirect: { destination: `/${reqCtx.role}`, permanent: false } };
  }

  return {
    props: {
      authContext: {
        role: reqCtx.role,
        company: reqCtx.company,
        moduleAccess: reqCtx.moduleAccess,
        viewer: reqCtx.viewer,
      },
    },
  };
}
