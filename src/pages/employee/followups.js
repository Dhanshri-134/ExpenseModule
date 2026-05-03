import EmployeeShell from "@/components/dashboard/EmployeeShell";
import FollowUpsPage from "@/components/dashboard/FollowUpsPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeFollowUpsRoute({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Follow-ups">
      <FollowUpsPage roleBase="employee" />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
