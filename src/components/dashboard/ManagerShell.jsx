import DashboardShell from "@/components/dashboard/DashboardShell";
import { DASHBOARD_NAVIGATION, filterNavigationForViewer } from "@/lib/dashboard";

export default function ManagerShell({ companyName, viewer, title, children }) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={filterNavigationForViewer(DASHBOARD_NAVIGATION.manager, viewer)}
      viewer={viewer}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}
