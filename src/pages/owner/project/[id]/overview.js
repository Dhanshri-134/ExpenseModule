import ProjectSectionPage from "@/components/dashboard/Project/ProjectSectionPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerProjectOverviewPage({ companyName, viewer, id }) {
  return (
    <ProjectSectionPage
      companyName={companyName}
      viewer={viewer}
      roleBase="owner"
      projectId={id}
      section="overview"
      ownerMode
    />
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
