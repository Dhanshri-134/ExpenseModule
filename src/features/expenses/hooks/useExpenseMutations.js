"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { invalidateProjectExpenses } from "@/shared/query/invalidation";
import { getApiErrorMessage } from "@/shared/services/api/errors";
import { sendJson } from "@/lib/client/apiClient";

export function useExpenseMutations({ projectId } = {}) {
  const saveMutation = useMutation({
    mutationFn: async (payload) =>
      sendJson("/api/project-expenses", {
        method: payload?.id ? "PUT" : "POST",
        body: payload,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, activeProjectId }) =>
      sendJson("/api/project-expenses", {
        method: "DELETE",
        body: { id, projectId: activeProjectId || projectId },
      }),
  });

  const syncExpenses = useCallback(
    async (activeProjectId) => {
      await invalidateProjectExpenses(activeProjectId || projectId);
    },
    [projectId]
  );

  const saveExpense = useCallback(
    async (payload) => {
      try {
        const result = await saveMutation.mutateAsync(payload);
        await syncExpenses(payload?.projectId);
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "expense_save_failed"));
      }
    },
    [saveMutation, syncExpenses]
  );

  const deleteExpense = useCallback(
    async ({ id, activeProjectId }) => {
      try {
        const result = await deleteMutation.mutateAsync({ id, activeProjectId });
        await syncExpenses(activeProjectId);
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "expense_delete_failed"));
      }
    },
    [deleteMutation, syncExpenses]
  );

  return {
    saveExpense,
    deleteExpense,
    saving: saveMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
