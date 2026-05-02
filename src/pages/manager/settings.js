import ManagerShell from "@/components/dashboard/ManagerShell";
import { SettingsPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerSettingsPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Profile">
      <SettingsPage />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
