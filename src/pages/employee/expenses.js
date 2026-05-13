import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const ExpensesWorkspacePage = dynamic(
  () => import("@/components/dashboard/Project/ProjectExpensesPage").then((mod) => mod.ExpensesWorkspacePage),
  { loading: () => <WorkspaceLoadingCard label="Loading expenses workspace..." /> }
);

export default function EmployeeExpensesPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Expenses">
      <ExpensesWorkspacePage roleBase="employee" currentUserId={authContext.viewer.id} />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
