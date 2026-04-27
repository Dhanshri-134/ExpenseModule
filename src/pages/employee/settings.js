import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { SettingsPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeSettingsPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Settings">
      <SettingsPage />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
