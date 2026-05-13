import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimate editor..." />,
});

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
