import ManagerShell from "@/components/dashboard/ManagerShell";
import TimeTrackingPage from "@/components/dashboard/TimeTrackingPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerTimeTrackingRoute({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Time Tracking">
      <TimeTrackingPage roleBase="manager" currentUserId={authContext.viewer.id} />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
