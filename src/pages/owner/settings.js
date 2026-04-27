import OwnerShell from "@/components/dashboard/OwnerShell";
import { SettingsPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerSettingsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Settings">
      <SettingsPage />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
