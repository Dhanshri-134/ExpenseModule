import ManagerShell from "@/components/dashboard/ManagerShell";
import { ExpensesWorkspacePage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

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
