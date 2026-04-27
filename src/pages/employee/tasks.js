import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { TasksManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeTasksPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Tasks">
      <TasksManagerPage roleBase="employee" currentUserId={authContext.viewer.id} />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}
