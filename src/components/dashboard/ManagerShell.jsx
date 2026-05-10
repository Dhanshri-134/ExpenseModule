import DashboardShell from "@/components/dashboard/DashboardShell";
import { DASHBOARD_NAVIGATION, filterNavigationByAccess } from "@/lib/dashboard";

export default function ManagerShell({ companyName, viewer, title, children }) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={filterNavigationByAccess(DASHBOARD_NAVIGATION.manager, viewer?.moduleAccess)}
      viewer={viewer}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}
