import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

function defaultTemplateConfiguration() {
  return {
    sections: {
      basicDetails: { enabled: true, label: "Basic Details" },
      labor: { enabled: true, label: "Labor" },
      material: { enabled: true, label: "Material" },
      equipment: { enabled: true, label: "Equipment" },
      overhead: { enabled: true, label: "Overhead" },
    },
    fields: {
      basicDetails: {
        title: true,
        estimateDate: true,
        validUntil: true,
        client: true,
        customerEmail: true,
        customerPhone: true,
        customerAddress: true,
        template: true,
        overheadPercent: true,
        profitPercent: true,
        commissionPercent: true,
        riskPercent: true,
        inflationRate: true,
        escalationYears: true,
        notes: true,
        terms: true,
        signature: true,
        stamp: true,
      },
      labor: {
        title: true,
        classification: true,
        baseWage: true,
        rates: true,
        straightTime: true,
        overtime: true,
        totalAmount: true,
        straightTimeCrew: true,
        overtimeCrew: true,
        targetWage: true,
        prevailWage: true,
        targetPay: true,
        prevailPay: true,
      },
      material: {
        code: true,
        description: true,
        quantity: true,
        uom: true,
        wastePercent: true,
        wasteQty: true,
        unitRate: true,
        cost: true,
        freight: true,
        costWithFreight: true,
        taxPercent: true,
        costWithTax: true,
        total: true,
      },
      equipment: {
        code: true,
        description: true,
        quantity: true,
        rentalDays: true,
        unitRate: true,
        cost: true,
        freight: true,
        costWithFreight: true,
        fuelPercent: true,
        costWithFuel: true,
        taxPercent: true,
        costWithTax: true,
        total: true,
      },
      overhead: {
        code: true,
        description: true,
        quantity: true,
        uom: true,
        unitRate: true,
        days: true,
        cost: true,
        taxPercent: true,
        costWithTax: true,
        total: true,
      },
    },
    branding: {
      templateHeader: "Standard Estimate Template",
      templateSubheader: "Prepared for client review",
      badgeLabel: "Standard",
      accentColor: "#1f5eff",
      canvasTint: "#f4f7ff",
      surfaceTint: "#ffffff",
      textColor: "#0f172a",
      logoUrl: "/assets/logo.png",
      showLogo: true,
    },
  };
}

function normalizeTemplateConfiguration(configuration) {
  const defaults = defaultTemplateConfiguration();
  const raw = configuration && typeof configuration === "object" ? configuration : {};
  const normalizedSections = Object.fromEntries(
    Object.entries(defaults.sections).map(([key, fallback]) => {
      const current = raw.sections?.[key];
      if (typeof current === "boolean") return [key, { ...fallback, enabled: current }];
      return [key, { ...fallback, ...(current && typeof current === "object" ? current : {}) }];
    })
  );

  const normalizedFields = Object.fromEntries(
    Object.entries(defaults.fields).map(([sectionKey, sectionDefaults]) => [
      sectionKey,
      {
        ...sectionDefaults,
        ...(raw.fields?.[sectionKey] && typeof raw.fields[sectionKey] === "object" ? raw.fields[sectionKey] : {}),
      },
    ])
  );

  return {
    sections: normalizedSections,
    fields: normalizedFields,
    branding: {
      ...defaults.branding,
      ...(raw.branding && typeof raw.branding === "object" ? raw.branding : {}),
    },
  };
}

const TemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  isDefault: z.boolean().optional().default(false),
  templateKind: z.string().trim().optional().default("standard"),
  configuration: z.record(z.string(), z.any()).optional().default({}),
});

async function ensureSingleDefault(admin, companyId, exceptId = null) {
  let query = admin.from("estimate_templates").update({ is_default: false }).eq("company_id", companyId);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw new Error(error.message || "template_default_reset_failed");
}

async function ensureStandardTemplate(ctx) {
  const { data: existing } = await ctx.admin
    .from("estimate_templates")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: true });

  if ((existing ?? []).length) {
    return (existing ?? []).map((template) => ({
      ...template,
      configuration: normalizeTemplateConfiguration(template.configuration),
    }));
  }

  const { data: created, error } = await ctx.admin
    .from("estimate_templates")
    .insert({
      company_id: ctx.company.id,
      name: "Standard Estimate Template",
      is_default: true,
      template_kind: "standard",
      configuration: defaultTemplateConfiguration(),
      created_by_user_id: ctx.user.id,
    })
    .select("*");

  if (error) throw new Error(error.message || "template_seed_failed");
  return (created ?? []).map((template) => ({
    ...template,
    configuration: normalizeTemplateConfiguration(template.configuration),
  }));
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    try {
      const templates = await ensureStandardTemplate(ctx);
      return sendOk(res, { templates });
    } catch (error) {
      return sendError(res, 500, "template_fetch_failed", error.message);
    }
  }

  if (req.method === "POST") {
    const parsed = TemplateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      if (parsed.data.isDefault) {
        await ensureSingleDefault(ctx.admin, ctx.company.id);
      }

      const { data, error } = await ctx.admin
        .from("estimate_templates")
        .insert({
          company_id: ctx.company.id,
          name: parsed.data.name,
          is_default: parsed.data.isDefault,
          template_kind: parsed.data.templateKind,
          configuration: normalizeTemplateConfiguration(parsed.data.configuration),
          created_by_user_id: ctx.user.id,
        })
        .select("*")
        .single();

      if (error || !data) return sendError(res, 500, "template_create_failed", error?.message);
      return sendOk(res, { template: data });
    } catch (error) {
      return sendError(res, 500, "template_create_failed", error.message);
    }
  }

  if (req.method === "PUT") {
    const parsed = TemplateSchema.extend({ id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      if (parsed.data.isDefault) {
        await ensureSingleDefault(ctx.admin, ctx.company.id, parsed.data.id);
      }

      const { data, error } = await ctx.admin
        .from("estimate_templates")
        .update({
          name: parsed.data.name,
          is_default: parsed.data.isDefault,
          template_kind: parsed.data.templateKind,
          configuration: normalizeTemplateConfiguration(parsed.data.configuration),
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", ctx.company.id)
        .eq("id", parsed.data.id)
        .select("*")
        .single();

      if (error || !data) return sendError(res, 500, "template_update_failed", error?.message);
      return sendOk(res, { template: data });
    } catch (error) {
      return sendError(res, 500, "template_update_failed", error.message);
    }
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      const { data: template, error: lookupError } = await ctx.admin
        .from("estimate_templates")
        .select("id, is_default, template_kind")
        .eq("company_id", ctx.company.id)
        .eq("id", parsed.data.id)
        .maybeSingle();

      if (lookupError) return sendError(res, 500, "template_lookup_failed", lookupError.message);
      if (!template) return sendError(res, 404, "template_not_found");
      if (template.template_kind === "standard") return sendError(res, 400, "template_delete_failed", "The standard template cannot be deleted.");
      if (template.is_default) return sendError(res, 400, "template_delete_failed", "Assign another default template before deleting this one.");

      const { error } = await ctx.admin
        .from("estimate_templates")
        .delete()
        .eq("company_id", ctx.company.id)
        .eq("id", parsed.data.id);

      if (error) return sendError(res, 500, "template_delete_failed", error.message);
      return sendOk(res, { deleted: true });
    } catch (error) {
      return sendError(res, 500, "template_delete_failed", error.message);
    }
  }

  return sendError(res, 405, "method_not_allowed");
}
