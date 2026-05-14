import { CalculationService } from "@/lib/server/estimating/calculationService";
import { RateService } from "@/lib/server/estimating/rateService";
import { TabulationService } from "@/lib/server/estimating/tabulationService";
import { roundCurrency, sumBy, toNumber, toPercent } from "@/lib/server/estimating/math";
import { mergeEstimateSummaryMeta } from "@/lib/projectModules";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildLegacyCostCodes(lineItems = []) {
  const groups = new Map();

  (lineItems ?? []).forEach((item, index) => {
    const code = normalizeText(item.costCode) || `AUTO-${index + 1}`;
    const name = normalizeText(item.scope) || normalizeText(item.description) || `Cost Code ${index + 1}`;

    if (!groups.has(code)) {
      groups.set(code, {
        code,
        name,
        description: normalizeText(item.description) || name,
        laborEntries: [],
        materialEntries: [],
        equipmentEntries: [],
        overheadEntries: [],
      });
    }

    const group = groups.get(code);
    const quantity = Math.max(toNumber(item.quantity, 0), 0);
    const laborHours = Math.max(toNumber(item.laborHours, 0), 0);
    const laborCost = Math.max(toNumber(item.laborCost, 0), 0);
    const materialCost = Math.max(toNumber(item.materialCost, 0), 0);
    const equipmentCost = Math.max(toNumber(item.equipmentCost, 0), 0);
    const directOverheadCost = Math.max(toNumber(item.directOverheadCost, 0), 0);
    const description = normalizeText(item.description) || normalizeText(item.scope) || `Line ${index + 1}`;

    if (laborCost || laborHours) {
      group.laborEntries.push({
        description,
        stHours: laborHours || (laborCost ? 1 : 0),
        stRate: laborHours ? laborCost / laborHours : laborCost,
        otHours: 0,
        otRate: 0,
      });
    }

    if (materialCost) {
      const baseQty = quantity || 1;
      group.materialEntries.push({
        description,
        quantity: baseQty,
        wastePercent: 0,
        unitRate: materialCost / baseQty,
        freight: 0,
        taxPercent: 0,
      });
    }

    if (equipmentCost) {
      group.equipmentEntries.push({
        description,
        qty: quantity || 1,
        days: 1,
        rate: equipmentCost / (quantity || 1),
        freight: 0,
        fuel: 0,
        taxPercent: 0,
      });
    }

    if (directOverheadCost) {
      group.overheadEntries.push({
        description,
        qty: quantity || 1,
        days: 1,
        rate: directOverheadCost / (quantity || 1),
        taxPercent: 0,
      });
    }
  });

  return [...groups.values()];
}

function processLaborEntries(entries = []) {
  const laborRates = [];
  const laborEntries = (entries ?? []).map((entry, index) => {
    const rateSource = entry.rate ? RateService.computeLaborRate(entry.rate) : null;

    if (rateSource) {
      laborRates.push({
        tempKey: entry.rate?.id || `${normalizeText(entry.description) || "rate"}-${index + 1}`,
        label: normalizeText(entry.rate?.label) || normalizeText(entry.description),
        projectUserId: entry.projectUserId || null,
        ...rateSource,
      });
    }

    return CalculationService.computeLabor({
      description: normalizeText(entry.description),
      projectUserId: entry.projectUserId || null,
      laborRateKey: rateSource ? laborRates[laborRates.length - 1].tempKey : entry.laborRateId || null,
      stHours: entry.stHours,
      stRate: rateSource?.stRate ?? entry.stRate,
      otHours: entry.otHours,
      otRate: rateSource?.otRate ?? entry.otRate,
      metadata: entry.metadata ?? {},
    });
  });

  return { laborEntries, laborRates };
}

function processMaterialEntries(entries = []) {
  return (entries ?? []).map((entry) =>
    CalculationService.computeMaterial({
      description: normalizeText(entry.description),
      materialId: entry.materialId || null,
      quantity: entry.quantity,
      wastePercent: entry.wastePercent,
      unitRate: entry.unitRate,
      freight: entry.freight,
      taxPercent: entry.taxPercent,
      metadata: entry.metadata ?? {},
    })
  );
}

function processEquipmentEntries(entries = []) {
  return (entries ?? []).map((entry) =>
    CalculationService.computeEquipment({
      description: normalizeText(entry.description),
      equipmentId: entry.equipmentId || null,
      qty: entry.qty,
      days: entry.days,
      rate: entry.rate,
      freight: entry.freight,
      fuel: entry.fuel,
      taxPercent: entry.taxPercent,
      metadata: entry.metadata ?? {},
    })
  );
}

function processOverheadEntries(entries = []) {
  return (entries ?? []).map((entry) =>
    CalculationService.computeOverhead({
      description: normalizeText(entry.description),
      qty: entry.qty,
      days: entry.days,
      rate: entry.rate,
      taxPercent: entry.taxPercent,
      metadata: entry.metadata ?? {},
    })
  );
}

export function buildEstimateComputation(payload = {}) {
  const normalizedCostCodes =
    payload.costCodes?.length ? payload.costCodes : buildLegacyCostCodes(payload.lineItems ?? []);

  const processedCostCodes = [];
  const laborRates = [];

  normalizedCostCodes.forEach((costCode, index) => {
    const processedLabor = processLaborEntries(costCode.laborEntries ?? []);
    const materialEntries = processMaterialEntries(costCode.materialEntries ?? []);
    const equipmentEntries = processEquipmentEntries(costCode.equipmentEntries ?? []);
    const overheadEntries = processOverheadEntries(costCode.overheadEntries ?? []);

    laborRates.push(...processedLabor.laborRates);
    processedCostCodes.push({
      id: costCode.id || null,
      displayOrder: index,
      costCodeId: costCode.costCodeId || costCode.costCode?.id || null,
      code: normalizeText(costCode.code || costCode.costCode?.code),
      name: normalizeText(costCode.name || costCode.costCode?.name) || `Cost Code ${index + 1}`,
      description: normalizeText(costCode.description || costCode.costCode?.description),
      laborEntries: processedLabor.laborEntries,
      materialEntries,
      equipmentEntries,
      overheadEntries,
      overheadPercent: costCode.overheadPercent ?? payload.overheadPercent ?? 0,
      profitPercent: costCode.profitPercent ?? payload.profitPercent ?? 0,
      commissionPercent: costCode.commissionPercent ?? payload.commissionPercent ?? 0,
      riskPercent: costCode.riskPercent ?? payload.riskPercent ?? 0,
      inflationRate: costCode.inflationRate ?? payload.inflationRate ?? 0,
      escalationYears: costCode.escalationYears ?? payload.escalationYears ?? 0,
    });
  });

  const projectSummary = TabulationService.aggregateProject({
    projectId: payload.projectId,
    costCodes: processedCostCodes,
    defaults: {
      overheadPercent: payload.overheadPercent ?? 0,
      profitPercent: payload.profitPercent ?? 0,
      commissionPercent: payload.commissionPercent ?? 0,
      riskPercent: payload.riskPercent ?? 0,
      inflationRate: payload.inflationRate ?? 0,
      escalationYears: payload.escalationYears ?? 0,
    },
  });

  return {
    laborRates,
    costCodes: projectSummary.costCodes,
    summary: {
      laborCost: projectSummary.laborCost,
      materialCost: projectSummary.materialCost,
      equipmentCost: projectSummary.equipmentCost,
      directOverheadCost: projectSummary.directOverheadCost,
      baseCost: projectSummary.totalCost,
      totalCost: projectSummary.totalCost,
      overheadPercent: toPercent(payload.overheadPercent ?? 0),
      overheadAmount: projectSummary.overhead,
      profitPercent: toPercent(payload.profitPercent ?? 0),
      profitAmount: projectSummary.profit,
      commissionPercent: toPercent(payload.commissionPercent ?? 0),
      commissionAmount: projectSummary.commission,
      riskPercent: toPercent(payload.riskPercent ?? 0),
      contingencyAmount: projectSummary.contingency,
      inflationRate: toPercent(payload.inflationRate ?? 0),
      escalationYears: toNumber(payload.escalationYears ?? 0),
      futureCost: projectSummary.futureCost,
      totalPrice: projectSummary.totalPrice,
      finalBid: projectSummary.finalBid,
    },
  };
}

export async function resolveOrCreateCostCode(admin, companyId, item) {
  if (item.costCodeId) {
    const { data: existing } = await admin
      .from("cost_codes")
      .select("id, code, name, description")
      .eq("company_id", companyId)
      .eq("id", item.costCodeId)
      .maybeSingle();

    if (existing) return existing;
  }

  const code = normalizeText(item.code);
  if (!code) {
    throw new Error("cost_code_required");
  }

  const { data: existingByCode } = await admin
    .from("cost_codes")
    .select("id, code, name, description")
    .eq("company_id", companyId)
    .eq("code", code)
    .maybeSingle();

  if (existingByCode) {
    return existingByCode;
  }

  const { data: created, error } = await admin
    .from("cost_codes")
    .insert({
      company_id: companyId,
      code,
      name: normalizeText(item.name) || code,
      description: normalizeText(item.description) || null,
    })
    .select("id, code, name, description")
    .single();

  if (error || !created) throw new Error(error?.message || "cost_code_create_failed");
  return created;
}

async function replaceEstimateChildren(admin, estimateId) {
  await admin.from("estimate_labor_entries").delete().eq("estimate_id", estimateId);
  await admin.from("estimate_material_entries").delete().eq("estimate_id", estimateId);
  await admin.from("estimate_equipment_entries").delete().eq("estimate_id", estimateId);
  await admin.from("estimate_direct_overhead_entries").delete().eq("estimate_id", estimateId);
  await admin.from("estimate_labor_rates").delete().eq("estimate_id", estimateId);
  await admin.from("estimate_cost_code_items").delete().eq("estimate_id", estimateId);
}

export async function persistEstimateGraph(admin, ctx, estimate, computed) {
  await replaceEstimateChildren(admin, estimate.id);

  const rateKeyMap = new Map();

  if (computed.laborRates.length) {
    const { data: createdRates, error } = await admin
      .from("estimate_labor_rates")
      .insert(
        computed.laborRates.map((rate) => ({
          estimate_id: estimate.id,
          company_id: ctx.company.id,
          project_id: estimate.project_id,
          project_user_id: rate.projectUserId || null,
          label: rate.label || null,
          base_wage: roundCurrency(rate.baseWage),
          fica: roundCurrency(rate.fica),
          sui: roundCurrency(rate.sui),
          fui: roundCurrency(rate.fui),
          workers_comp: roundCurrency(rate.workersComp),
          liability: roundCurrency(rate.liability),
          benefits: roundCurrency(rate.benefits),
          tools: roundCurrency(rate.tools),
          ppe: roundCurrency(rate.ppe),
          overhead_percent: toPercent(rate.overheadPercent),
          loaded_cost: roundCurrency(rate.loadedCost),
          overhead: roundCurrency(rate.overhead),
          st_rate: roundCurrency(rate.stRate),
          ot_rate: roundCurrency(rate.otRate),
        }))
      )
      .select("id, st_rate, ot_rate");

    if (error) throw new Error(error.message || "labor_rate_insert_failed");

    (createdRates ?? []).forEach((rateRow, index) => {
      rateKeyMap.set(computed.laborRates[index].tempKey, rateRow);
    });
  }

  for (let index = 0; index < computed.costCodes.length; index += 1) {
    const row = computed.costCodes[index];
    const costCode = await resolveOrCreateCostCode(admin, ctx.company.id, row.costCode);

    const { data: itemRow, error: itemError } = await admin
      .from("estimate_cost_code_items")
      .insert({
        estimate_id: estimate.id,
        company_id: ctx.company.id,
        project_id: estimate.project_id,
        cost_code_id: costCode.id,
        description: row.costCode.description || null,
        display_order: index,
        labor_cost: row.laborCost,
        material_cost: row.materialCost,
        equipment_cost: row.equipmentCost,
        direct_overhead: row.directOverhead,
        total_cost: row.totalCost,
        overhead_percent: row.overheadPercent,
        overhead: row.overhead,
        profit_percent: row.profitPercent,
        profit: row.profit,
        commission_percent: row.commissionPercent,
        commission: row.commission,
        risk_percent: row.riskPercent,
        contingency: row.contingency,
        inflation_rate: row.inflationRate,
        escalation_years: row.escalationYears,
        future_cost: row.futureCost,
        total_price: row.totalPrice,
      })
      .select("id")
      .single();

    if (itemError || !itemRow) throw new Error(itemError?.message || "estimate_cost_code_insert_failed");

    if (row.laborEntries.length) {
      const { error } = await admin.from("estimate_labor_entries").insert(
        row.laborEntries.map((entry) => ({
          estimate_id: estimate.id,
          company_id: ctx.company.id,
          project_id: estimate.project_id,
          cost_code_id: costCode.id,
          cost_code_item_id: itemRow.id,
          project_user_id: entry.projectUserId || null,
          labor_rate_id: entry.laborRateKey ? rateKeyMap.get(entry.laborRateKey)?.id ?? null : null,
          description: entry.description || null,
          st_hours: entry.stHours,
          st_rate: entry.stRate,
          st_cost: entry.stCost,
          ot_hours: entry.otHours,
          ot_rate: entry.otRate,
          ot_cost: entry.otCost,
          total_cost: entry.totalCost,
          metadata: entry.metadata ?? {},
        }))
      );

      if (error) throw new Error(error.message || "estimate_labor_insert_failed");
    }

    if (row.materialEntries.length) {
      const { error } = await admin.from("estimate_material_entries").insert(
        row.materialEntries.map((entry) => ({
          estimate_id: estimate.id,
          company_id: ctx.company.id,
          project_id: estimate.project_id,
          cost_code_id: costCode.id,
          cost_code_item_id: itemRow.id,
          material_id: entry.materialId || null,
          description: entry.description || null,
          quantity: entry.quantity,
          waste_percent: entry.wastePercent,
          adjusted_qty: entry.adjustedQty,
          unit_rate: entry.unitRate,
          base_cost: entry.baseCost,
          freight: entry.freight,
          tax_percent: entry.taxPercent,
          total_cost: entry.totalCost,
          metadata: entry.metadata ?? {},
        }))
      );

      if (error) throw new Error(error.message || "estimate_material_insert_failed");
    }

    if (row.equipmentEntries.length) {
      const { error } = await admin.from("estimate_equipment_entries").insert(
        row.equipmentEntries.map((entry) => ({
          estimate_id: estimate.id,
          company_id: ctx.company.id,
          project_id: estimate.project_id,
          cost_code_id: costCode.id,
          cost_code_item_id: itemRow.id,
          equipment_id: entry.equipmentId || null,
          description: entry.description || null,
          qty: entry.qty,
          days: entry.days,
          rate: entry.rate,
          base: entry.base,
          freight: entry.freight,
          fuel: entry.fuel,
          subtotal: entry.subtotal,
          tax_percent: entry.taxPercent,
          total_cost: entry.totalCost,
          metadata: entry.metadata ?? {},
        }))
      );

      if (error) throw new Error(error.message || "estimate_equipment_insert_failed");
    }

    if (row.overheadEntries.length) {
      const { error } = await admin.from("estimate_direct_overhead_entries").insert(
        row.overheadEntries.map((entry) => ({
          estimate_id: estimate.id,
          company_id: ctx.company.id,
          project_id: estimate.project_id,
          cost_code_id: costCode.id,
          cost_code_item_id: itemRow.id,
          description: entry.description || null,
          qty: entry.qty,
          days: entry.days,
          rate: entry.rate,
          base: entry.base,
          tax_percent: entry.taxPercent,
          total_cost: entry.totalCost,
          metadata: entry.metadata ?? {},
        }))
      );

      if (error) throw new Error(error.message || "estimate_overhead_insert_failed");
    }
  }
}

function buildLegacyLineItemsFromCostCodes(costCodes = []) {
  return (costCodes ?? []).map((row, index) => ({
    id: row.costCode?.id || `line-${index + 1}`,
    scope: row.costCode?.name || "",
    costCode: row.costCode?.code || "",
    description: row.costCode?.description || "",
    unit: "",
    quantity: sumBy(row.materialEntries, (entry) => entry.quantity),
    laborHours: roundCurrency(
      sumBy(row.laborEntries, (entry) => entry.stHours) + sumBy(row.laborEntries, (entry) => entry.otHours)
    ),
    laborCost: row.laborCost,
    materialCost: row.materialCost,
    equipmentCost: row.equipmentCost,
    directOverheadCost: row.directOverhead,
    totalCost: row.totalCost,
    notes: "",
  }));
}

function splitSubcontractorLaborEntries(entries = []) {
  const laborEntries = [];
  const subcontractorEntries = [];

  for (const entry of entries ?? []) {
    if (entry?.metadata?.kind === "subcontractor") {
      subcontractorEntries.push({
        ...entry,
        cost: toNumber(entry.metadata?.cost),
        workersCompPercent: toNumber(entry.metadata?.workersCompPercent),
        liabilityPercent: toNumber(entry.metadata?.liabilityPercent),
        overheadPercent: toNumber(entry.metadata?.overheadPercent),
        profitPercent: toNumber(entry.metadata?.profitPercent),
      });
      continue;
    }
    laborEntries.push(entry);
  }

  return { laborEntries, subcontractorEntries };
}

export async function loadEstimateGraph(admin, estimateIds = []) {
  if (!estimateIds.length) return new Map();

  const [
    { data: costCodeItems, error: ccError },
    { data: laborRates, error: lrError },
    { data: laborEntries, error: leError },
    { data: materialEntries, error: meError },
    { data: equipmentEntries, error: eeError },
    { data: overheadEntries, error: oeError },
  ] = await Promise.all([
    admin
      .from("estimate_cost_code_items")
      .select("id, estimate_id, cost_code_id, description, display_order, labor_cost, material_cost, equipment_cost, direct_overhead, total_cost, overhead_percent, overhead, profit_percent, profit, commission_percent, commission, risk_percent, contingency, inflation_rate, escalation_years, future_cost, total_price, cost_codes:cost_code_id (id, code, name, description)")
      .in("estimate_id", estimateIds)
      .order("display_order", { ascending: true }),
    admin.from("estimate_labor_rates").select("*").in("estimate_id", estimateIds),
    admin.from("estimate_labor_entries").select("*").in("estimate_id", estimateIds),
    admin.from("estimate_material_entries").select("*").in("estimate_id", estimateIds),
    admin.from("estimate_equipment_entries").select("*").in("estimate_id", estimateIds),
    admin.from("estimate_direct_overhead_entries").select("*").in("estimate_id", estimateIds),
  ]);

  if (ccError || lrError || leError || meError || eeError || oeError) {
    throw new Error(
      ccError?.message ||
        lrError?.message ||
        leError?.message ||
        meError?.message ||
        eeError?.message ||
        oeError?.message ||
        "estimate_graph_load_failed"
    );
  }

  const rateMap = new Map((laborRates ?? []).map((rate) => [rate.id, rate]));
  const byCostCodeItemId = {
    labor: new Map(),
    material: new Map(),
    equipment: new Map(),
    overhead: new Map(),
  };

  for (const entry of laborEntries ?? []) {
    const list = byCostCodeItemId.labor.get(entry.cost_code_item_id) ?? [];
    list.push({
      id: entry.id,
      description: entry.description || "",
      projectUserId: entry.project_user_id,
      laborRateId: entry.labor_rate_id,
      rate: entry.labor_rate_id ? rateMap.get(entry.labor_rate_id) ?? null : null,
      stHours: toNumber(entry.st_hours),
      stRate: toNumber(entry.st_rate),
      stCost: toNumber(entry.st_cost),
      otHours: toNumber(entry.ot_hours),
      otRate: toNumber(entry.ot_rate),
      otCost: toNumber(entry.ot_cost),
      totalCost: toNumber(entry.total_cost),
      metadata: entry.metadata ?? {},
    });
    byCostCodeItemId.labor.set(entry.cost_code_item_id, list);
  }

  for (const entry of materialEntries ?? []) {
    const list = byCostCodeItemId.material.get(entry.cost_code_item_id) ?? [];
    list.push({
      id: entry.id,
      description: entry.description || "",
      materialId: entry.material_id,
      quantity: toNumber(entry.quantity),
      wastePercent: toNumber(entry.waste_percent),
      adjustedQty: toNumber(entry.adjusted_qty),
      unitRate: toNumber(entry.unit_rate),
      baseCost: toNumber(entry.base_cost),
      freight: toNumber(entry.freight),
      taxPercent: toNumber(entry.tax_percent),
      totalCost: toNumber(entry.total_cost),
      metadata: entry.metadata ?? {},
    });
    byCostCodeItemId.material.set(entry.cost_code_item_id, list);
  }

  for (const entry of equipmentEntries ?? []) {
    const list = byCostCodeItemId.equipment.get(entry.cost_code_item_id) ?? [];
    list.push({
      id: entry.id,
      description: entry.description || "",
      equipmentId: entry.equipment_id,
      qty: toNumber(entry.qty),
      days: toNumber(entry.days),
      rate: toNumber(entry.rate),
      base: toNumber(entry.base),
      freight: toNumber(entry.freight),
      fuel: toNumber(entry.fuel),
      subtotal: toNumber(entry.subtotal),
      taxPercent: toNumber(entry.tax_percent),
      totalCost: toNumber(entry.total_cost),
      metadata: entry.metadata ?? {},
    });
    byCostCodeItemId.equipment.set(entry.cost_code_item_id, list);
  }

  for (const entry of overheadEntries ?? []) {
    const list = byCostCodeItemId.overhead.get(entry.cost_code_item_id) ?? [];
    list.push({
      id: entry.id,
      description: entry.description || "",
      qty: toNumber(entry.qty),
      days: toNumber(entry.days),
      rate: toNumber(entry.rate),
      base: toNumber(entry.base),
      taxPercent: toNumber(entry.tax_percent),
      totalCost: toNumber(entry.total_cost),
      metadata: entry.metadata ?? {},
    });
    byCostCodeItemId.overhead.set(entry.cost_code_item_id, list);
  }

  const graph = new Map();

  for (const row of costCodeItems ?? []) {
    const estimateRows = graph.get(row.estimate_id) ?? [];
    const splitEntries = splitSubcontractorLaborEntries(byCostCodeItemId.labor.get(row.id) ?? []);
    estimateRows.push({
      id: row.id,
      costCode: {
        id: row.cost_codes?.id || row.cost_code_id,
        code: row.cost_codes?.code || "",
        name: row.cost_codes?.name || "",
        description: row.cost_codes?.description || row.description || "",
      },
      description: row.description || "",
      laborEntries: splitEntries.laborEntries,
      subcontractorEntries: splitEntries.subcontractorEntries,
      materialEntries: byCostCodeItemId.material.get(row.id) ?? [],
      equipmentEntries: byCostCodeItemId.equipment.get(row.id) ?? [],
      overheadEntries: byCostCodeItemId.overhead.get(row.id) ?? [],
      laborCost: toNumber(row.labor_cost),
      materialCost: toNumber(row.material_cost),
      equipmentCost: toNumber(row.equipment_cost),
      directOverhead: toNumber(row.direct_overhead),
      totalCost: toNumber(row.total_cost),
      overheadPercent: toNumber(row.overhead_percent),
      overhead: toNumber(row.overhead),
      profitPercent: toNumber(row.profit_percent),
      profit: toNumber(row.profit),
      commissionPercent: toNumber(row.commission_percent),
      commission: toNumber(row.commission),
      riskPercent: toNumber(row.risk_percent),
      contingency: toNumber(row.contingency),
      inflationRate: toNumber(row.inflation_rate),
      escalationYears: toNumber(row.escalation_years),
      futureCost: toNumber(row.future_cost),
      totalPrice: toNumber(row.total_price),
    });
    graph.set(row.estimate_id, estimateRows);
  }

  return graph;
}

export function composeEstimateRecord(estimate, costCodes = []) {
  const summaryBase =
    !estimate.summary || !Object.keys(estimate.summary).length
      ? buildEstimateComputation({
          projectId: estimate.project_id,
          overheadPercent: estimate.overhead_percent,
          profitPercent: estimate.profit_percent,
          commissionPercent: estimate.commission_percent,
          riskPercent: estimate.risk_percent,
          inflationRate: estimate.inflation_rate,
          escalationYears: estimate.escalation_years,
          costCodes,
        }).summary
      : estimate.summary;

  const summary = mergeEstimateSummaryMeta(summaryBase, estimate.summary);

  return {
    ...estimate,
    cost_codes: costCodes,
    line_items: buildLegacyLineItemsFromCostCodes(costCodes),
    summary,
  };
}
