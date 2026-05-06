import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { composeEstimateRecord, loadEstimateGraph } from "@/lib/server/estimating/estimateEngine";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "GET") return sendError(res, 405, "method_not_allowed");

  const [{ data: estimates, error: estimatesError }, { data: projects }, { data: clients }] = await Promise.all([
    ctx.admin.from("project_estimates").select("*").eq("company_id", ctx.company.id).order("created_at", { ascending: false }),
    ctx.admin.from("projects").select("id, name, client_id").eq("company_id", ctx.company.id),
    ctx.admin.from("clients").select("id, name").eq("company_id", ctx.company.id),
  ]);

  if (estimatesError) return sendError(res, 500, "estimates_fetch_failed", estimatesError.message);

  const visibleEstimates =
    ctx.role === "owner"
      ? estimates ?? []
      : (estimates ?? []).filter((estimate) => !estimate.project_id || ctx.projectIds.includes(estimate.project_id));

  const graph = await loadEstimateGraph(ctx.admin, (visibleEstimates ?? []).map((estimate) => estimate.id));
  const directory = await loadUserDirectory(
    ctx.admin,
    ctx.company.id,
    [...new Set((visibleEstimates ?? []).map((estimate) => estimate.prepared_by_user_id).filter(Boolean))]
  );

  const projectMap = new Map((projects ?? []).map((project) => [project.id, project]));
  const clientMap = new Map((clients ?? []).map((client) => [client.id, client]));

  const enriched = (visibleEstimates ?? []).map((estimate) => ({
    ...composeEstimateRecord(estimate, graph.get(estimate.id) ?? []),
    prepared_by: estimate.prepared_by_user_id ? directory.get(estimate.prepared_by_user_id) ?? null : null,
    project: estimate.project_id ? projectMap.get(estimate.project_id) ?? null : null,
    client: estimate.client_id ? clientMap.get(estimate.client_id) ?? null : null,
  }));

  return sendOk(res, {
    estimates: enriched,
    projects: (projects ?? []).map((project) => ({
      ...project,
      client: project.client_id ? clientMap.get(project.client_id) ?? null : null,
    })),
  });
}
