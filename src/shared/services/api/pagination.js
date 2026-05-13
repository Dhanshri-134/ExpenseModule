const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toPositiveInteger(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function parsePaginationParams(query = {}, defaults = {}) {
  const page = toPositiveInteger(query.page, defaults.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(
    toPositiveInteger(query.pageSize, defaults.pageSize ?? DEFAULT_PAGE_SIZE),
    defaults.maxPageSize ?? MAX_PAGE_SIZE
  );
  const enabled = query.page !== undefined || query.pageSize !== undefined;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return {
    enabled,
    page,
    pageSize,
    from,
    to,
  };
}

export function buildPaginationMeta(total, pagination) {
  const safeTotal = Number(total || 0);
  const pageCount = pagination.pageSize ? Math.max(1, Math.ceil(safeTotal / pagination.pageSize)) : 1;

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: safeTotal,
    pageCount,
    hasPreviousPage: pagination.page > 1,
    hasNextPage: pagination.page < pageCount,
  };
}

export function paginateCollection(items = [], pagination) {
  const list = Array.isArray(items) ? items : [];
  if (!pagination?.enabled) {
    return {
      items: list,
      pagination: buildPaginationMeta(list.length, {
        page: 1,
        pageSize: list.length || DEFAULT_PAGE_SIZE,
      }),
    };
  }

  return {
    items: list.slice(pagination.from, pagination.to + 1),
    pagination: buildPaginationMeta(list.length, pagination),
  };
}
