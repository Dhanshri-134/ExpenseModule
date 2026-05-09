import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeNewEstimatePage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="New Estimate">
      <EstimateDashboardPage roleBase="employee" standalone />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
