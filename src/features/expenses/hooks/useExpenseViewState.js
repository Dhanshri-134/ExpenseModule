"use client";

import { useCallback, useState } from "react";

const INITIAL_FILTERS = {
  search: "",
  projectId: "all",
  expenseType: "all",
  status: "all",
  startDate: "",
  endDate: "",
  createdByUserId: "all",
};

export function useExpenseViewState() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const updateFilters = useCallback((updater) => {
    setFilters((current) => (typeof updater === "function" ? updater(current) : updater));
  }, []);

  return {
    filters,
    setFilters: updateFilters,
  };
}
