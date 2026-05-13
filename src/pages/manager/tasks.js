import dynamic from "next/dynamic";
import ManagerShell from "@/components/dashboard/ManagerShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const TasksManagerPage = dynamic(
  () => import("@/components/dashboard/task/TasksManagerPage").then((mod) => mod.TasksManagerPage),
  { loading: () => <WorkspaceLoadingCard label="Loading tasks workspace..." /> }
);

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
