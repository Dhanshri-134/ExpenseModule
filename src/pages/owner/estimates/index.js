import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimates workspace..." />,
});

export default function OwnerEstimatesPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Estimates">
      <EstimateDashboardPage roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
