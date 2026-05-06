import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { FlowPlaceholderPage } from "@/components/dashboard/FlowPlaceholderPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeInvoicingPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Invoicing">
      <FlowPlaceholderPage
        title="Invoicing Flow"
        description="Invoicing is now placed after Estimates in the employee dashboard flow. The existing project dashboard is kept as-is for the current release."
      />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
