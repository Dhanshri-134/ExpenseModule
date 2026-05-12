import ProjectSectionPage from "@/components/dashboard/Project/ProjectSectionPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeProjectExpensesPage({ companyName, viewer, id }) {
  return (
    <ProjectSectionPage
      companyName={companyName}
      viewer={viewer}
      roleBase="employee"
      projectId={id}
      section="expenses"
    />
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
