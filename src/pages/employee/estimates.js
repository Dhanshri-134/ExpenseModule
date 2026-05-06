import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeEstimatesPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Estimates">
      <EstimateDashboardPage roleBase="employee" />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
