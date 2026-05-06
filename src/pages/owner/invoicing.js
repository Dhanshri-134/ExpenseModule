import OwnerShell from "@/components/dashboard/OwnerShell";
import { InvoicingWorkspace } from "@/components/dashboard/InvoicingWorkspace";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerInvoicingPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Invoicing">
      <InvoicingWorkspace roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
