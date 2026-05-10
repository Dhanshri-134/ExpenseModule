import EmployeeShell from "@/components/dashboard/EmployeeShell";
import TimeTrackingPage from "@/components/dashboard/TimeTrackingPage";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeTimeTrackingRoute({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Check In / Out">
      <TimeTrackingPage roleBase="employee" currentUserId={authContext.viewer.id} />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
