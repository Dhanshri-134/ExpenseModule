"use client";

import { memo } from "react";
import { TaskCard } from "@/components/dashboard/task/TaskWidgets";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function TaskListSectionComponent({
  tasksLoading,
  visibleTasks,
  canCreateTask,
  roleBase,
  currentUserId,
  deleteTaskId,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  onSubmitAssignment,
  onReviewAssignment,
}) {
  if (tasksLoading) {
    return <div className={cardClass("mt-4 text-sm text-[color:var(--acm-muted-fg)]")}>Loading tasks...</div>;
  }

  return (
    <section className="mt-4 grid gap-4">
      {visibleTasks.map((task) => {
        const canModifyTask =
          canCreateTask &&
          (roleBase === "owner" || task.creator?.user_id === currentUserId) &&
          task.approver_user_id !== currentUserId;

        return (
          <TaskCard
            key={task.id}
            task={task}
            canEdit={canModifyTask}
            canDelete={canModifyTask}
            deleteBusy={deleteTaskId === task.id}
            onOpen={() => onOpenTask(task)}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task)}
            onSubmitAssignment={onSubmitAssignment}
            onReviewAssignment={(assignment) => onReviewAssignment(task, assignment)}
          />
        );
      })}

      {!visibleTasks.length ? (
        <div className={cardClass("text-sm text-[color:var(--acm-muted-fg)]")}>
          No tasks available for the selected workflow filters.
        </div>
      ) : null}
    </section>
  );
}

export const TaskListSection = memo(TaskListSectionComponent);
