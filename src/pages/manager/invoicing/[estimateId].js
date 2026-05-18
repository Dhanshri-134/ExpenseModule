import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoice details..." /> }
);

export default function ManagerInvoiceDetailPage({ authContext, estimateId }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Invoice Details">
      <InvoicingWorkspace roleBase="manager" initialEstimateId={estimateId} standalone />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["manager"]);
  if (!result.props) return result;

  return {
    props: {
      ...result.props,
      estimateId: ctx.params.estimateId,
    },
  };
}
