import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FieldReportsWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectOperationsPanels").then((mod) => mod.FieldReportsWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading field reports workspace..." /> }
);

export default function OwnerFieldReportsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Field Reports">
      <FieldReportsWorkspacePage roleBase="owner" currentUserId={viewer.id} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
