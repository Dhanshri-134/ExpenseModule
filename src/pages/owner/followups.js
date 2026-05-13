import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FollowUpsPage = dynamic(() => import("@/components/dashboard/FollowUpsPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading follow-ups..." />,
});

export default function OwnerFollowUpsRoute({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Follow-ups">
      <FollowUpsPage roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
