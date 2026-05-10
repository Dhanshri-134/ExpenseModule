import DashboardShell from "@/components/dashboard/DashboardShell";
import { DASHBOARD_NAVIGATION, filterNavigationByAccess } from "@/lib/dashboard";

export default function OwnerShell({
  companyName,
  viewer,
  title,
  children,
}) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={filterNavigationByAccess(DASHBOARD_NAVIGATION.owner, viewer?.moduleAccess)}
      viewer={viewer}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}
