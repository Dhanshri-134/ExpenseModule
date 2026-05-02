import { roundCurrency, toPercent } from "@/lib/server/estimating/math";

export const RateService = {
  computeLaborRate(rate = {}) {
    const loadedCost = roundCurrency(
      (Number(rate.baseWage) || 0) +
        (Number(rate.fica) || 0) +
        (Number(rate.sui) || 0) +
        (Number(rate.fui) || 0) +
        (Number(rate.workersComp) || 0) +
        (Number(rate.liability) || 0) +
        (Number(rate.benefits) || 0) +
        (Number(rate.tools) || 0) +
        (Number(rate.ppe) || 0)
    );
    const overheadPercent = toPercent(rate.overheadPercent);
    const overhead = roundCurrency(loadedCost * overheadPercent);
    const stRate = roundCurrency(loadedCost + overhead);
    const otRate = roundCurrency(stRate * 1.5);

    return {
      ...rate,
      overheadPercent,
      loadedCost,
      overhead,
      stRate,
      otRate,
    };
  },
};
