import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { FieldReportsWorkspacePage } from "@/components/dashboard/Project/ProjectOperationsPanels";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeFieldReportsPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Field Reports">
      <FieldReportsWorkspacePage roleBase="employee" currentUserId={authContext.viewer.id} />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
