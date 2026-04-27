import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerProjectDashboardPage() {
  return null;
}

export async function getServerSideProps(ctx) {
  const result = await requireOwner(ctx);
  if (!result.props) return result;
  return {
    redirect: {
      destination: `/owner/project/${ctx.params.id}/overview`,
      permanent: false,
    },
  };
}
