import ProjectShell from "@/components/dashboard/Project/ProjectShell";
import { ProjectExpensesPage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerProjectExpensesPage({ companyName, viewer, id }) {
  return (
    <ProjectShell
      companyName={companyName}
      viewer={viewer}
      title="Project Expenses"
      roleBase="manager"
      projectId={id}
    >
      <ProjectExpensesPage projectId={id} roleBase="manager" currentUserId={viewer.id} />
    </ProjectShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["manager"]);
  if (!result.props) return result;
  return {
    props: {
      ...result.props,
      id: ctx.params.id,
    },
  };
}
