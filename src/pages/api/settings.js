import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const UpdateSettingsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const { data: membership, error: membershipError } = await ctx.admin
      .from("company_users")
      .select("company_id, user_id, role, user_code, person_id, mobile_no, hourly_rate")
      .eq("company_id", ctx.company.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    if (membershipError || !membership) return sendError(res, 404, "membership_not_found");

    const { data: person } = membership.person_id
      ? await ctx.admin
          .from("people")
          .select("id, name, email, contact, address")
          .eq("id", membership.person_id)
          .maybeSingle()
      : { data: null };

    return sendOk(res, {
      profile: {
        userId: ctx.user.id,
        role: ctx.role,
        userCode: membership.user_code,
        name: person?.name || ctx.user.user_metadata?.full_name || ctx.user.user_metadata?.name || "",
        email: person?.email || ctx.user.email || "",
        mobile: membership.mobile_no || person?.contact || "",
        address: person?.address || "",
        hourlyRate: membership.hourly_rate || 0,
      },
    });
  }

  if (req.method === "PUT") {
    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;

    const { data: membership, error: membershipError } = await ctx.admin
      .from("company_users")
      .select("company_id, user_id, person_id")
      .eq("company_id", ctx.company.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    if (membershipError || !membership) return sendError(res, 404, "membership_not_found");

    let personId = membership.person_id || null;

    if (personId) {
      const { error: personError } = await ctx.admin
        .from("people")
        .update({
          name: payload.name,
          email: payload.email,
          contact: payload.mobile || null,
          address: payload.address || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);

      if (personError) return sendError(res, 500, "person_update_failed", personError.message);
    } else {
      const { data: person, error: personError } = await ctx.admin
        .from("people")
        .insert({
          name: payload.name,
          email: payload.email,
          contact: payload.mobile || null,
          address: payload.address || null,
        })
        .select("id")
        .single();

      if (personError || !person) return sendError(res, 500, "person_create_failed", personError?.message);
      personId = person.id;

      const { error: membershipUpdateError } = await ctx.admin
        .from("company_users")
        .update({ person_id: personId, mobile_no: payload.mobile || "" })
        .eq("company_id", ctx.company.id)
        .eq("user_id", ctx.user.id);

      if (membershipUpdateError) return sendError(res, 500, "membership_update_failed", membershipUpdateError.message);
    }

    const { error: membershipError2 } = await ctx.admin
      .from("company_users")
      .update({ mobile_no: payload.mobile || "" })
      .eq("company_id", ctx.company.id)
      .eq("user_id", ctx.user.id);

    if (membershipError2) return sendError(res, 500, "membership_update_failed", membershipError2.message);

    const { error: authError } = await ctx.admin.auth.admin.updateUserById(ctx.user.id, {
      email: payload.email,
      user_metadata: {
        ...ctx.user.user_metadata,
        full_name: payload.name,
        name: payload.name,
        mobile_no: payload.mobile || "",
      },
    });

    if (authError) return sendError(res, 500, "auth_update_failed", authError.message);

    return sendOk(res, { updated: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
