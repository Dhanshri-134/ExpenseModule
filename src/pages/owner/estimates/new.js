import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const EstimateDashboardPage = dynamic(() => import("@/components/dashboard/EstimateDashboardPage"), {
  loading: () => <WorkspaceLoadingCard label="Loading estimate editor..." />,
});

export default function OwnerNewEstimatePage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="New Estimate">
      <EstimateDashboardPage roleBase="owner" standalone />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
