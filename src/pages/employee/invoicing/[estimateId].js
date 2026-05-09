import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { InvoicingWorkspace } from "@/components/dashboard/InvoicingWorkspace";
import { requireRolePage } from "@/lib/pages/requireRolePage";

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
