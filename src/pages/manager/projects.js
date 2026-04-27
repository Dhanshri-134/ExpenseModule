import ManagerShell from "@/components/dashboard/ManagerShell";
import { ProjectsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireRolePage } from "@/lib/pages/requireRolePage";

export default function ManagerProjectsPage({ authContext }) {
  return (
    <ManagerShell companyName={authContext.company.name} viewer={authContext.viewer} title="Projects">
      <ProjectsManagerPage roleBase="manager" />
    </ManagerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireRolePage(ctx, ["manager"]);
}

