import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoice details..." /> }
);

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
