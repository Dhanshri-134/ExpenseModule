import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { EstimateCostLinePage } from "@/components/dashboard/EstimateCostLinePage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeEstimateCostLineRoute({ authContext, estimateId, costLineId }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Cost Line Details">
      <EstimateCostLinePage roleBase="employee" estimateId={estimateId} costLineId={costLineId} />
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
      costLineId: ctx.params.costLineId,
    },
  };
}
