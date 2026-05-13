import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimates workspace..." />,
});

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
