import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoice form..." /> }
);

export default function EmployeeInvoiceCreatePage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Create Invoice">
      <InvoicingWorkspace roleBase="employee" standalone />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
