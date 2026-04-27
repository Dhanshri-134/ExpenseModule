import OwnerShell from "@/components/dashboard/OwnerShell";
import { DashboardOverview } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerDashboardPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Overview">
      <DashboardOverview roleBase="owner" canManageStaff canAssignManagerTasks />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}

