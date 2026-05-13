"use client";

import { memo } from "react";

function fieldClass(error = false) {
  return `acm-input mt-0 ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`.trim();
}

function TaskBoardControlsComponent({
  tabs,
  tab,
  searchQuery,
  sortBy,
  statusFilter,
  roleBase,
  roleFilter,
  projectFilter,
  fixedProjectId,
  projectList,
  onSearchChange,
  onTabChange,
  onSortChange,
  onStatusFilterChange,
  onRoleFilterChange,
  onProjectFilterChange,
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            className={`${fieldClass()} min-w-[220px] flex-1 md:max-w-md`}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks, assignees, or projects"
          />
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`acm-btn ${tab === item.key ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid gap-3 ${roleBase === "owner" ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-4"}`}>
          <select className={fieldClass()} value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
            <option value="latest">Latest Created</option>
            <option value="deadline">Deadline</option>
          </select>
          <select className={fieldClass()} value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {roleBase !== "owner" ? (
            <select className={fieldClass()} value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value)}>
              <option value="all">All Roles</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          ) : null}
          <select
            className={fieldClass()}
            value={projectFilter}
            onChange={(event) => onProjectFilterChange(event.target.value)}
            disabled={Boolean(fixedProjectId)}
          >
            <option value="all">All Projects</option>
            {projectList.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name ?? "-"}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export const TaskBoardControls = memo(TaskBoardControlsComponent);
