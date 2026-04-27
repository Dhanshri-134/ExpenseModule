import ProjectSectionPage from "@/components/dashboard/Project/ProjectSectionPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeProjectOverviewPage({ authContext, id }) {
  return (
    <ProjectSectionPage
      companyName={authContext.company.name}
      viewer={authContext.viewer}
      roleBase="employee"
      projectId={id}
      section="overview"
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
