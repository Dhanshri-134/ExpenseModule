import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { InvoicingWorkspace } from "@/components/dashboard/InvoicingWorkspace";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeInvoicingPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Invoices">
      <InvoicingWorkspace roleBase="employee" />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
