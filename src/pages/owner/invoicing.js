import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const InvoicingWorkspace = dynamic(
  () => import("@/components/dashboard/InvoicingWorkspace").then((mod) => mod.InvoicingWorkspace),
  { loading: () => <WorkspaceLoadingCard label="Loading invoicing workspace..." /> }
);

export default function OwnerInvoicingPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Invoices">
      <InvoicingWorkspace roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
