import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimate details..." />,
});

export default function EmployeeEstimateDetailPage({ authContext, estimateId }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Estimate">
      <EstimateDashboardPage roleBase="employee" initialEstimateId={estimateId} standalone />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["employee"]);
  if (!result.props) return result;

  return {
    props: {
      ...result.props,
      estimateId: ctx.params.estimateId,
    },
  };
}
