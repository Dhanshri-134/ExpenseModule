"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendJson } from "@/lib/client/apiClient";
import { invalidateDashboardSummary, invalidateTasksList } from "@/shared/query/invalidation";
import { getApiErrorMessage } from "@/shared/services/api/errors";

export function useTaskMutations({ fixedProjectId = "", refreshStaff } = {}) {
  const syncTaskWorkspace = useCallback(
    async ({ includeStaff = false } = {}) => {
      await Promise.all([
        invalidateTasksList(fixedProjectId),
        invalidateDashboardSummary(),
        includeStaff && typeof refreshStaff === "function" ? refreshStaff() : Promise.resolve(),
      ]);
    },
    [fixedProjectId, refreshStaff]
  );

  const saveTaskMutation = useMutation({
    mutationFn: async ({ payload, isEditing }) =>
      sendJson("/api/tasks", {
        method: isEditing ? "PUT" : "POST",
        body: payload,
      }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async ({ id }) =>
      sendJson("/api/tasks", {
        method: "DELETE",
        body: { id },
      }),
  });

  const submitTaskMutation = useMutation({
    mutationFn: async (payload) =>
      sendJson("/api/task-submissions", {
        method: "POST",
        body: payload,
      }),
  });

  const reviewTaskMutation = useMutation({
    mutationFn: async (payload) =>
      sendJson("/api/task-approvals", {
        method: "POST",
        body: payload,
      }),
  });

  const saveTask = useCallback(
    async ({ payload, isEditing = false, includeStaff = false } = {}) => {
      try {
        const result = await saveTaskMutation.mutateAsync({ payload, isEditing });
        await syncTaskWorkspace({ includeStaff });
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "task_save_failed"));
      }
    },
    [saveTaskMutation, syncTaskWorkspace]
  );

  const deleteTask = useCallback(
    async ({ id }) => {
      try {
        const result = await deleteTaskMutation.mutateAsync({ id });
        await syncTaskWorkspace();
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "task_delete_failed"));
      }
    },
    [deleteTaskMutation, syncTaskWorkspace]
  );

  const submitTaskWork = useCallback(
    async (payload) => {
      try {
        const result = await submitTaskMutation.mutateAsync(payload);
        await syncTaskWorkspace();
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "task_submission_failed"));
      }
    },
    [submitTaskMutation, syncTaskWorkspace]
  );

  const reviewTaskSubmission = useCallback(
    async (payload) => {
      try {
        const result = await reviewTaskMutation.mutateAsync(payload);
        await syncTaskWorkspace();
        return result;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "task_review_failed"));
      }
    },
    [reviewTaskMutation, syncTaskWorkspace]
  );

  return {
    saveTask,
    deleteTask,
    submitTaskWork,
    reviewTaskSubmission,
    savingTask: saveTaskMutation.isPending,
    deletingTask: deleteTaskMutation.isPending,
    submittingTask: submitTaskMutation.isPending,
    reviewingTask: reviewTaskMutation.isPending,
  };
}
