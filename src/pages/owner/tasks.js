import OwnerShell from "@/components/dashboard/OwnerShell";
import { TasksManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerTasksPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Tasks">
      <TasksManagerPage roleBase="owner" canAssignManagers canCreateTask currentUserId={viewer.id} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
