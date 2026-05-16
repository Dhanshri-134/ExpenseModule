import { roundCurrency, toNumber, toPercent } from "@/lib/server/estimating/math";

export const CalculationService = {
  computeLabor(entry = {}) {
    const stHours = toNumber(entry.stHours);
    const stRate = toNumber(entry.stRate);
    const otHours = toNumber(entry.otHours);
    const otRate = toNumber(entry.otRate);
    const stCost = roundCurrency(stHours * stRate);
    const otCost = roundCurrency(otHours * otRate);
    const baseCost = roundCurrency(stCost + otCost);

    const overheadPercent = toPercent(entry.metadata?.overheadPercent ?? entry.overheadPercent);
    const profitPercent = toPercent(entry.metadata?.profitPercent ?? entry.profitPercent);

    const overhead = roundCurrency(baseCost * overheadPercent);
    const subtotal = roundCurrency(baseCost + overhead);
    const profit = roundCurrency(subtotal * profitPercent);
    const totalCost = roundCurrency(subtotal + profit);

    return {
      ...entry,
      stHours,
      stRate,
      stCost,
      otHours,
      otRate,
      otCost,
      baseCost,
      overhead,
      subtotal,
      profit,
      totalCost,
    };
  },

  computeMaterial(entry = {}) {
    const quantity = toNumber(entry.quantity);
    const wastePercent = toPercent(entry.wastePercent);
    const unitRate = toNumber(entry.unitRate);
    const freight = toNumber(entry.freight);
    const taxPercent = toPercent(entry.taxPercent);
    const adjustedQty = roundCurrency(quantity * (1 + wastePercent));
    const materialBase = roundCurrency(adjustedQty * unitRate);
    const costWithFreight = roundCurrency(materialBase + freight);
    const baseCost = roundCurrency(costWithFreight * (1 + taxPercent));

    const overheadPercent = toPercent(entry.metadata?.overheadPercent ?? entry.overheadPercent);
    const profitPercent = toPercent(entry.metadata?.profitPercent ?? entry.profitPercent);

    const overhead = roundCurrency(baseCost * overheadPercent);
    const subtotal = roundCurrency(baseCost + overhead);
    const profit = roundCurrency(subtotal * profitPercent);
    const totalCost = roundCurrency(subtotal + profit);

    return {
      ...entry,
      quantity,
      wastePercent,
      adjustedQty,
      unitRate,
      baseCost,
      freight,
      costWithFreight,
      taxPercent,
      overhead,
      subtotal,
      profit,
      totalCost,
    };
  },

  computeEquipment(entry = {}) {
    const qty = toNumber(entry.qty);
    const days = toNumber(entry.days);
    const rate = toNumber(entry.rate);
    const freight = toNumber(entry.freight);
    const fuel = toNumber(entry.fuel);
    const taxPercent = toPercent(entry.taxPercent);
    const base = roundCurrency(qty * days * rate);
    const subtotalWithFreight = roundCurrency(base + freight + fuel);
    const baseCost = roundCurrency(subtotalWithFreight * (1 + taxPercent));

    const overheadPercent = toPercent(entry.metadata?.overheadPercent ?? entry.overheadPercent);
    const profitPercent = toPercent(entry.metadata?.profitPercent ?? entry.profitPercent);

    const overhead = roundCurrency(baseCost * overheadPercent);
    const subtotal = roundCurrency(baseCost + overhead);
    const profit = roundCurrency(subtotal * profitPercent);
    const totalCost = roundCurrency(subtotal + profit);

    return {
      ...entry,
      qty,
      days,
      rate,
      base,
      freight,
      fuel,
      baseCost,
      taxPercent,
      overhead,
      subtotal,
      profit,
      totalCost,
    };
  },

  computeOverhead(entry = {}) {
    const qty = toNumber(entry.qty);
    const days = toNumber(entry.days);
    const rate = toNumber(entry.rate);
    const taxPercent = toPercent(entry.taxPercent);
    const base = roundCurrency(qty * days * rate);
    const totalCost = roundCurrency(base * (1 + taxPercent));

    return {
      ...entry,
      qty,
      days,
      rate,
      base,
      taxPercent,
      totalCost,
    };
  },

  computeContingency(totalCost, riskPercent) {
    return roundCurrency(toNumber(totalCost) * toPercent(riskPercent));
  },

  computeEscalation(presentCost, inflationRate, years) {
    return roundCurrency(toNumber(presentCost) * (1 + toPercent(inflationRate)) ** toNumber(years));
  },

  computeSubcontractor(entry = {}) {
    const amount = toNumber(entry.amount);
    const workersComp = roundCurrency(amount * toPercent(entry.workersCompPercent));
    const liability = roundCurrency(amount * toPercent(entry.liabilityPercent));
    const baseSubtotal = roundCurrency(amount + workersComp + liability);
    const overhead = roundCurrency(baseSubtotal * toPercent(entry.overheadPercent));
    const subtotal = roundCurrency(baseSubtotal + overhead);
    const profit = roundCurrency(subtotal * toPercent(entry.profitPercent));
    const totalCost = roundCurrency(subtotal + profit);

    return {
      ...entry,
      amount,
      workersComp,
      liability,
      overhead,
      subtotal,
      profit,
      totalCost,
    };
  }
};
