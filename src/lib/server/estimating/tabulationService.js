import { CalculationService } from "@/lib/server/estimating/calculationService";
import { roundCurrency, sumBy, toNumber, toPercent } from "@/lib/server/estimating/math";

function aggregateCostCodeRow({
  costCode,
  laborEntries = [],
  materialEntries = [],
  equipmentEntries = [],
  overheadEntries = [],
  overheadPercent = 0,
  profitPercent = 0,
  commissionPercent = 0,
  riskPercent = 0,
  inflationRate = 0,
  escalationYears = 0,
}) {
  const laborCost = sumBy(laborEntries, (entry) => entry.totalCost);
  const materialCost = sumBy(materialEntries, (entry) => entry.totalCost);
  const equipmentCost = sumBy(equipmentEntries, (entry) => entry.totalCost);
  const directOverhead = sumBy(overheadEntries, (entry) => entry.totalCost);

  const totalCost = roundCurrency(laborCost + materialCost + equipmentCost + directOverhead);
  const normalizedOverheadPercent = toPercent(overheadPercent);
  const normalizedProfitPercent = toPercent(profitPercent);
  const normalizedCommissionPercent = toPercent(commissionPercent);
  const normalizedRiskPercent = toPercent(riskPercent);
  const normalizedInflationRate = toPercent(inflationRate);
  const normalizedEscalationYears = toNumber(escalationYears);

  const overhead = roundCurrency(totalCost * normalizedOverheadPercent);
  const profit = roundCurrency((totalCost + overhead) * normalizedProfitPercent);
  const commission = roundCurrency((totalCost + overhead + profit) * normalizedCommissionPercent);
  const totalPrice = roundCurrency(totalCost + overhead + profit + commission);
  const contingency = CalculationService.computeContingency(totalCost, normalizedRiskPercent);
  const futureCost = CalculationService.computeEscalation(totalPrice, normalizedInflationRate, normalizedEscalationYears);

  return {
    costCode,
    laborEntries,
    materialEntries,
    equipmentEntries,
    overheadEntries,
    laborCost,
    materialCost,
    equipmentCost,
    directOverhead,
    totalCost,
    overheadPercent: normalizedOverheadPercent,
    overhead,
    profitPercent: normalizedProfitPercent,
    profit,
    commissionPercent: normalizedCommissionPercent,
    commission,
    riskPercent: normalizedRiskPercent,
    contingency,
    inflationRate: normalizedInflationRate,
    escalationYears: normalizedEscalationYears,
    futureCost,
    totalPrice,
  };
}

export const TabulationService = {
  aggregateCostCode({ projectId, costCodes = [], defaults = {} }) {
    return (costCodes ?? []).map((item) =>
      aggregateCostCodeRow({
        costCode: {
          id: item.costCodeId || item.costCode?.id || null,
          code: item.code || item.costCode?.code || "",
          name: item.name || item.costCode?.name || "",
          description: item.description || item.costCode?.description || "",
        },
        laborEntries: item.laborEntries ?? [],
        materialEntries: item.materialEntries ?? [],
        equipmentEntries: item.equipmentEntries ?? [],
        overheadEntries: item.overheadEntries ?? [],
        overheadPercent: item.overheadPercent ?? defaults.overheadPercent ?? 0,
        profitPercent: item.profitPercent ?? defaults.profitPercent ?? 0,
        commissionPercent: item.commissionPercent ?? defaults.commissionPercent ?? 0,
        riskPercent: item.riskPercent ?? defaults.riskPercent ?? 0,
        inflationRate: item.inflationRate ?? defaults.inflationRate ?? 0,
        escalationYears: item.escalationYears ?? defaults.escalationYears ?? 0,
        projectId,
      })
    );
  },

  aggregateProject({ projectId, costCodes = [], defaults = {} }) {
    const rows = this.aggregateCostCode({ projectId, costCodes, defaults });

    return {
      projectId,
      costCodes: rows,
      laborCost: sumBy(rows, (row) => row.laborCost),
      materialCost: sumBy(rows, (row) => row.materialCost),
      equipmentCost: sumBy(rows, (row) => row.equipmentCost),
      directOverheadCost: sumBy(rows, (row) => row.directOverhead),
      totalCost: sumBy(rows, (row) => row.totalCost),
      overhead: sumBy(rows, (row) => row.overhead),
      profit: sumBy(rows, (row) => row.profit),
      commission: sumBy(rows, (row) => row.commission),
      contingency: sumBy(rows, (row) => row.contingency),
      futureCost: sumBy(rows, (row) => row.futureCost),
      finalBid: sumBy(rows, (row) => row.totalPrice),
      totalPrice: sumBy(rows, (row) => row.totalPrice),
      overheadPercent: toPercent(defaults.overheadPercent ?? 0),
      profitPercent: toPercent(defaults.profitPercent ?? 0),
      commissionPercent: toPercent(defaults.commissionPercent ?? 0),
      riskPercent: toPercent(defaults.riskPercent ?? 0),
      inflationRate: toPercent(defaults.inflationRate ?? 0),
      escalationYears: toNumber(defaults.escalationYears ?? 0),
    };
  },
};
