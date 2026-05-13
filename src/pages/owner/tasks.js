import dynamic from "next/dynamic";
import OwnerShell from "@/components/dashboard/OwnerShell";
import { requireOwner } from "@/lib/pages/requireOwner";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const TasksManagerPage = dynamic(
  () => import("@/components/dashboard/task/TasksManagerPage").then((mod) => mod.TasksManagerPage),
  { loading: () => <WorkspaceLoadingCard label="Loading tasks workspace..." /> }
);

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
