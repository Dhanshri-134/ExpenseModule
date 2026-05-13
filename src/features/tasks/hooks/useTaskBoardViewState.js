"use client";

import { useCallback, useDeferredValue, useState } from "react";

export function useTaskBoardViewState({ fixedProjectId = "" } = {}) {
  const [tab, setTab] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState(fixedProjectId || "all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const updateTab = useCallback((value) => setTab(value), []);
  const updateSortBy = useCallback((value) => setSortBy(value), []);
  const updateStatusFilter = useCallback((value) => setStatusFilter(value), []);
  const updateProjectFilter = useCallback((value) => setProjectFilter(value), []);
  const updateRoleFilter = useCallback((value) => setRoleFilter(value), []);
  const updateSearchQuery = useCallback((value) => setSearchQuery(value), []);

  return {
    tab,
    sortBy,
    statusFilter,
    projectFilter,
    roleFilter,
    searchQuery,
    deferredSearchQuery,
    updateTab,
    updateSortBy,
    updateStatusFilter,
    updateProjectFilter,
    updateRoleFilter,
    updateSearchQuery,
  };
}
