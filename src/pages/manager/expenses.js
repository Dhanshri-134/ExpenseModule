import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const ExpensesWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectExpensesPage").then((mod) => mod.ExpensesWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading expenses workspace..." /> }
);

export default function ManagerExpensesPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Expenses">
      <ExpensesWorkspacePage roleBase="manager" currentUserId={authContext.viewer.id} />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
