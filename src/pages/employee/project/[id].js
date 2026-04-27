import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeProjectDashboardPage() {
  return null;
}

export async function getServerSideProps(ctx) {
  const result = await requireRolePage(ctx, ["employee"]);
  if (!result.props) return result;
  return {
    redirect: {
      destination: `/employee/project/${ctx.params.id}/overview`,
      permanent: false,
    },
  };
}
