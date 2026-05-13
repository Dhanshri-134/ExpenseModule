import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FieldReportsWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectOperationsPanels").then((mod) => mod.FieldReportsWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading field reports workspace..." /> }
);

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
