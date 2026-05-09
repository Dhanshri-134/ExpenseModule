import ManagerShell from "@/components/dashboard/ManagerShell";
import { LeadsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerLeadsPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Leads">
      <LeadsManagerPage roleBase="manager" canCreateLead />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
