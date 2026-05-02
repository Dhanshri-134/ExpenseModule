import { roundCurrency, toNumber, toPercent } from "@/lib/server/estimating/math";

export const CalculationService = {
  computeLabor(entry = {}) {
    const stHours = toNumber(entry.stHours);
    const stRate = toNumber(entry.stRate);
    const otHours = toNumber(entry.otHours);
    const otRate = toNumber(entry.otRate);
    const stCost = roundCurrency(stHours * stRate);
    const otCost = roundCurrency(otHours * otRate);
    const totalCost = roundCurrency(stCost + otCost);

    return {
      ...entry,
      stHours,
      stRate,
      stCost,
      otHours,
      otRate,
      otCost,
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
    const baseCost = roundCurrency(adjustedQty * unitRate);
    const costWithFreight = roundCurrency(baseCost + freight);
    const totalCost = roundCurrency(costWithFreight * (1 + taxPercent));

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
    const subtotal = roundCurrency(base + freight + fuel);
    const totalCost = roundCurrency(subtotal * (1 + taxPercent));

    return {
      ...entry,
      qty,
      days,
      rate,
      base,
      freight,
      fuel,
      subtotal,
      taxPercent,
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
};
