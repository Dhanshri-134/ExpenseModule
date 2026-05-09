import OwnerShell from "@/components/dashboard/OwnerShell";
import { InvoicingWorkspace } from "@/components/dashboard/InvoicingWorkspace";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerInvoiceDetailPage({ companyName, viewer, estimateId }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Invoice Details">
      <InvoicingWorkspace roleBase="owner" initialEstimateId={estimateId} standalone />
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
