import DashboardShell from "@/components/dashboard/DashboardShell";
import { DASHBOARD_NAVIGATION } from "@/lib/dashboard";

export default function EmployeeShell({ companyName, viewer, title, children }) {
  return (
    <DashboardShell
      companyName={companyName}
      navigation={DASHBOARD_NAVIGATION.employee}
      viewer={viewer}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}

