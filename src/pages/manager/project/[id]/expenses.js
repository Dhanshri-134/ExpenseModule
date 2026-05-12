import ProjectSectionPage from "@/components/dashboard/Project/ProjectSectionPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerProjectExpensesPage({ companyName, viewer, id }) {
  return (
    <ProjectSectionPage
      companyName={companyName}
      viewer={viewer}
      roleBase="manager"
      projectId={id}
      section="expenses"
    />
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
