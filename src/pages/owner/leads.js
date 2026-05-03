import OwnerShell from "@/components/dashboard/OwnerShell";
import { LeadsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerLeadsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Leads">
      <LeadsManagerPage roleBase="owner" canCreateLead />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
