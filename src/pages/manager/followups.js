import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FollowUpsPage = dynamic(() => import("@/components/dashboard/FollowUpsPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading follow-ups..." />,
});

export default function ManagerFollowUpsRoute({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Follow-ups">
      <FollowUpsPage roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
