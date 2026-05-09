import OwnerShell from "@/components/dashboard/OwnerShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerEstimateDetailPage({ companyName, viewer, estimateId }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Estimate">
      <EstimateDashboardPage roleBase="owner" initialEstimateId={estimateId} standalone />
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
    },
  };
}
