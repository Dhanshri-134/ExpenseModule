import OwnerShell from "@/components/dashboard/OwnerShell";
import { ExpensesWorkspacePage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireOwner } from "@/lib/pages/requireOwner";

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
