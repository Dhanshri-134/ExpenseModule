import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoice details..." /> }
);

export default function EmployeeInvoiceDetailPage({ authContext, estimateId }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Invoice Details">
      <InvoicingWorkspace roleBase="employee" initialEstimateId={estimateId} standalone />
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
