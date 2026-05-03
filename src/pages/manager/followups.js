import ManagerShell from "@/components/dashboard/ManagerShell";
import FollowUpsPage from "@/components/dashboard/FollowUpsPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerFollowUpsRoute({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Follow-ups">
      <FollowUpsPage roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
