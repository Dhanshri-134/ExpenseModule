import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoicing workspace..." /> }
);

export default function ManagerInvoicingPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Invoices">
      <InvoicingWorkspace roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
