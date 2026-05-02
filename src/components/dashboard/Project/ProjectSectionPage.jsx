import ProjectShell from "@/components/dashboard/Project/ProjectShell";
import { ProjectDashboardView } from "@/components/dashboard/DashboardClientPages";

export const PROJECT_SECTION_TITLES = {
  overview: "Project Overview",
  staff: "Project Staff",
  tasks: "Project Tasks",
  estimates: "Project Estimates",
  reports: "Project Field Reports",
  expenses: "Project Expenses",
};

export default function ProjectSectionPage({
  companyName,
  viewer,
  roleBase,
  projectId,
  section,
  ownerMode = false,
}) {
  return (
    <ProjectShell
      companyName={companyName}
      viewer={viewer}
      title={PROJECT_SECTION_TITLES[section] || "Project Dashboard"}
      roleBase={roleBase}
      projectId={projectId}
    >
      <ProjectDashboardView
        projectId={projectId}
        roleBase={roleBase}
        ownerMode={ownerMode}
        section={section}
        currentUserId={viewer.id}
      />
    </ProjectShell>
  );
}
