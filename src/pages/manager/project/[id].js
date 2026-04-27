import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerProjectDashboardPage() {
  return null;
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["manager"]);
  if (!result.props) return result;
  return {
    redirect: {
      destination: `/manager/project/${ctx.params.id}/overview`,
      permanent: false,
    },
  };
}
