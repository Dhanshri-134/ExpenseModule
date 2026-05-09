import ManagerShell from "@/components/dashboard/ManagerShell";
import { FieldReportsWorkspacePage } from "@/components/dashboard/Project/ProjectOperationsPanels";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerFieldReportsPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Field Reports">
      <FieldReportsWorkspacePage roleBase="manager" currentUserId={authContext.viewer.id} />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
