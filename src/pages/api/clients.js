import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { createFollowUp } from "@/lib/server/followups";
import { sendError, sendOk } from "@/lib/server/responses";

const ClientSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().optional().nullable().default(""),
  contact: z.string().trim().optional().nullable().default(""),
  email: z.union([z.string().trim().email(), z.literal(""), z.null(), z.undefined()]).default(""),
  followUpDate: z.string().optional().nullable(),
  followUpNote: z.string().trim().optional().nullable(),
  followUpStatus: z.enum(["pending", "done"]).optional().nullable(),
});

const UpdateClientSchema = ClientSchema.extend({
  id: z.string().uuid(),
});

const DeleteClientSchema = z.object({
  id: z.string().uuid(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const { data: clients, error } = await ctx.admin
      .from("clients")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false });

    if (error) return sendError(res, 500, "clients_fetch_failed", error.message);

    const clientIds = (clients ?? []).map((client) => client.id);
    const { data: projects, error: projectsError } = clientIds.length
      ? await ctx.admin
          .from("projects")
          .select("id, client_id")
          .eq("company_id", ctx.company.id)
          .in("client_id", clientIds)
      : { data: [], error: null };

    if (projectsError) return sendError(res, 500, "client_projects_fetch_failed", projectsError.message);

    const projectCountByClientId = new Map();
    for (const project of projects ?? []) {
      if (!project.client_id) continue;
      projectCountByClientId.set(project.client_id, (projectCountByClientId.get(project.client_id) ?? 0) + 1);
    }

    return sendOk(res, {
      clients: (clients ?? []).map((client) => ({
        ...client,
        projectCount: projectCountByClientId.get(client.id) ?? 0,
      })),
    });
  }

  if (req.method === "POST") {
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    const { data: client, error } = await ctx.admin
      .from("clients")
      .insert({
        company_id: ctx.company.id,
        name: payload.name,
        address: payload.address || null,
        contact: payload.contact || null,
        email: payload.email || null,
      })
      .select("*")
      .single();

    if (error || !client) return sendError(res, 500, "client_create_failed", error?.message);

    if (payload.followUpDate && payload.followUpNote) {
      try {
        await createFollowUp(ctx, {
          refId: client.id,
          refType: "client",
          date: payload.followUpDate,
          note: payload.followUpNote,
          status: payload.followUpStatus ?? "pending",
        });
      } catch (followUpError) {
        return sendError(res, 500, "client_followup_create_failed", followUpError.message);
      }
    }

    return sendOk(res, { client });
  }

  if (req.method === "PUT") {
    const parsed = UpdateClientSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const { id, ...payload } = parsed.data;
    const { data: client, error } = await ctx.admin
      .from("clients")
      .update({
        name: payload.name,
        address: payload.address || null,
        contact: payload.contact || null,
        email: payload.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("*")
      .single();

    if (error || !client) return sendError(res, 500, "client_update_failed", error?.message);
    return sendOk(res, { client });
  }

  if (req.method === "DELETE") {
    const parsed = DeleteClientSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const { error } = await ctx.admin
      .from("clients")
      .delete()
      .eq("id", parsed.data.id)
      .eq("company_id", ctx.company.id);

    if (error) return sendError(res, 500, "client_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
