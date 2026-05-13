import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FieldReportsWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectOperationsPanels").then((mod) => mod.FieldReportsWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading field reports workspace..." /> }
);

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
