import ProjectShell from "@/components/dashboard/Project/ProjectShell";
import { ProjectExpensesPage } from "@/components/dashboard/Project/ProjectExpensesPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerProjectExpensesPage({ companyName, viewer, id }) {
  return (
    <ProjectShell
      companyName={companyName}
      viewer={viewer}
      title="Project Expenses"
      roleBase="owner"
      projectId={id}
    >
      <ProjectExpensesPage projectId={id} roleBase="owner" currentUserId={viewer.id} />
    </ProjectShell>
  );
}

export async function getServerSideProps(ctx) {
  const result = await requireOwner(ctx);
  if (!result.props) return result;
  return {
    props: {
      ...result.props,
      id: ctx.params.id,
    },
  };
}
