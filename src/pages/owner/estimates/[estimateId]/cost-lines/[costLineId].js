import OwnerShell from "@/components/dashboard/OwnerShell";
import { EstimateCostLinePage } from "@/components/dashboard/EstimateCostLinePage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerEstimateCostLineRoute({ companyName, viewer, estimateId, costLineId }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Cost Line Details">
      <EstimateCostLinePage roleBase="owner" estimateId={estimateId} costLineId={costLineId} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireOwner(ctx);
  if (!result.props) return result;

  return {
    props: {
      ...result.props,
      estimateId: ctx.params.estimateId,
      costLineId: ctx.params.costLineId,
    },
  };
}
