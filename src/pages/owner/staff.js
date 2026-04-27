import OwnerShell from "@/components/dashboard/OwnerShell";
import { StaffManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerStaffPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Staff">
      <StaffManagerPage allowManagerCreation ownerMode currentUserId={viewer.id} canAssignManagers />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
