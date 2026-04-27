import ManagerShell from "@/components/dashboard/ManagerShell";
import { TasksManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerTasksPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Tasks">
      <TasksManagerPage roleBase="manager" canCreateTask currentUserId={authContext.viewer.id} />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}
