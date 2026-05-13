import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimates workspace..." />,
});

export default function ManagerEstimatesPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Estimates">
      <EstimateDashboardPage roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
