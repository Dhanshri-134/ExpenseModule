import DashboardShell from "@/components/dashboard/DashboardShell";
import { getProjectNavigation } from "@/lib/dashboard";

export default function ProjectShell({
  companyName,
  viewer,
  title,
  roleBase,
  projectId,
  children,
}) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={getProjectNavigation(roleBase, projectId)}
      viewer={viewer}
      title={title}
      showBackButton
      backHref={`/${roleBase}/projects`}
    >
      {children}
    </DashboardShell>
  );
}
