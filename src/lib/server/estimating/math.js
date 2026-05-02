export function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toPercent(value) {
  const parsed = toNumber(value, 0);
  if (parsed < 0) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function roundCurrency(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 10000) / 10000;
}

export function sumBy(items, selector) {
  return roundCurrency((items ?? []).reduce((total, item) => total + toNumber(selector(item), 0), 0));
}
