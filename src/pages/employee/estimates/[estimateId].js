import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

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
