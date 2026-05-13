import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const ExpensesWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectExpensesPage").then((mod) => mod.ExpensesWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading expenses workspace..." /> }
);

export default function OwnerExpensesPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Expenses">
      <ExpensesWorkspacePage roleBase="owner" currentUserId={viewer.id} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
