import dynamic from "next/dynamic";
import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { requireRolePage } from "@/lib/pages/requireRolePage";
import { WorkspaceLoadingCard } from "@/shared/ui/feedback/WorkspaceLoadingCard";

const TasksManagerPage = dynamic(
  () => import("@/components/dashboard/task/TasksManagerPage").then((mod) => mod.TasksManagerPage),
  { loading: () => <WorkspaceLoadingCard label="Loading tasks workspace..." /> }
);

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
