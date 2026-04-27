import DashboardShell from "@/components/dashboard/DashboardShell";
import { DASHBOARD_NAVIGATION } from "@/lib/dashboard";

export default function ManagerShell({ companyName, viewer, title, children }) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={DASHBOARD_NAVIGATION.manager}
      viewer={viewer}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}

