import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { ExpensesWorkspacePage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

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
