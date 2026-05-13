import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const FollowUpsPage = dynamic(() => import("@/components/dashboard/FollowUpsPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading follow-ups..." />,
});

export default function EmployeeFollowUpsRoute({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Follow-ups">
      <FollowUpsPage roleBase="employee" />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
