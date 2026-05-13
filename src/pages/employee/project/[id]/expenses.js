import ProjectShell from "@/components/dashboard/Project/ProjectShell";
import { ProjectExpensesPage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeProjectExpensesPage({ companyName, viewer, id }) {
  return (
    <ProjectShell
      companyName={companyName}
      viewer={viewer}
      title="Project Expenses"
      roleBase="employee"
      projectId={id}
    >
      <ProjectExpensesPage projectId={id} roleBase="employee" currentUserId={viewer.id} />
    </ProjectShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["employee"]);
  if (!result.props) return result;
  return {
    props: {
      ...result.props,
      id: ctx.params.id,
    },
  };
}
