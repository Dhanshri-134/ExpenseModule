import ProjectSectionPage from "@/components/dashboard/Project/ProjectSectionPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerProjectEstimatesPage({ authContext, id }) {
  return (
    <ProjectSectionPage
      companyName={authContext.company.name}
      viewer={authContext.viewer}
      roleBase="manager"
      projectId={id}
      section="estimates"
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
