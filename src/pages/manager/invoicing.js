import ManagerShell from "@/components/dashboard/ManagerShell";
import { InvoicingWorkspace } from "@/components/dashboard/InvoicingWorkspace";
import { requireRolePage } from "@/lib/pages/requireRolePage";

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
