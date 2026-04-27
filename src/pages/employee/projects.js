import EmployeeShell from "@/components/dashboard/EmployeeShell";
import { ProjectsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function EmployeeProjectsPage({ authContext }) {
  return (
    <EmployeeShell companyName={authContext.company.name} viewer={authContext.viewer} title="Projects">
      <ProjectsManagerPage roleBase="employee" />
    </EmployeeShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["employee"]);
}

