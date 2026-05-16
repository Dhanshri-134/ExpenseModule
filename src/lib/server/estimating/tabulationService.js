import { CalculationService } from "@/lib/server/estimating/calculationService";
import { roundCurrency, sumBy, toNumber, toPercent } from "@/lib/server/estimating/math";

function aggregateCostCodeRow({
  costCode,
  laborEntries = [],
  subcontractorEntries = [],
  materialEntries = [],
  equipmentEntries = [],
  overheadEntries = [],
  overheadPercent = 0,
  profitPercent = 0,
}) {
  const laborCost = sumBy(laborEntries, (entry) => entry.totalCost);
  const subcontractorCost = sumBy(
  subcontractorEntries,
  (entry) => entry.totalCost
);
  const materialCost = sumBy(materialEntries, (entry) => entry.totalCost);
  const equipmentCost = sumBy(equipmentEntries, (entry) => entry.totalCost);
  const directOverhead = sumBy(
  overheadEntries,
  (entry) => entry.totalCost
);

const totalCost = roundCurrency(
  laborCost +
  materialCost +
  equipmentCost +
  directOverhead +
  subcontractorCost
);
  const normalizedOverheadPercent = toPercent(overheadPercent);
  const normalizedProfitPercent = toPercent(profitPercent);

  const overhead = roundCurrency(totalCost * normalizedOverheadPercent);
  const markupBase = roundCurrency(totalCost + overhead);

  const profit = roundCurrency(markupBase * normalizedProfitPercent);
  const commission = 0;
  const totalPrice = roundCurrency(totalCost + overhead + profit);

  return {
    id: costCode?.id || null,
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
    commissionPercent: 0,
    commission,
    riskPercent: 0,
    contingency: 0,
    inflationRate: 0,
    escalationYears: 0,
    futureCost: 0,
    totalPrice,
    subcontractorEntries,
subcontractorCost,
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
        projectId,
        subcontractorEntries: item.subcontractorEntries ?? [],
        subcontractorCost: item.subcontractorCost ?? 0,
      })
    );
  },

  aggregateProject({ projectId, costCodes = [], defaults = {} }) {
    const rows = this.aggregateCostCode({ projectId, costCodes, defaults });

    return {
      projectId,
      costCodes: rows,
      laborCost: sumBy(rows, (row) => row.laborCost),
      subcontractorCost: sumBy(
  rows,
  (row) => row.subcontractorCost
),
      materialCost: sumBy(rows, (row) => row.materialCost),
      equipmentCost: sumBy(rows, (row) => row.equipmentCost),
      directOverheadCost: sumBy(rows, (row) => row.directOverhead),
      totalCost: sumBy(rows, (row) => row.totalCost),
      overhead: sumBy(rows, (row) => row.overhead),
      profit: sumBy(rows, (row) => row.profit),
      commission: 0,
      contingency: 0,
      futureCost: 0,
      finalBid: sumBy(rows, (row) => row.totalPrice),
      totalPrice: sumBy(rows, (row) => row.totalPrice),
      overheadPercent: toPercent(defaults.overheadPercent ?? 0),
      profitPercent: toPercent(defaults.profitPercent ?? 0),
      commissionPercent: 0,
      riskPercent: 0,
      inflationRate: 0,
      escalationYears: 0,
    };
  },
};
