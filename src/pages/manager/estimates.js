import ManagerShell from "@/components/dashboard/ManagerShell";
import EstimateDashboardPage from "@/components/dashboard/EstimateDashboardPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerEstimatesPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Estimates">
      <EstimateDashboardPage roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
