import OwnerShell from "@/components/dashboard/OwnerShell";
import { ProjectsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerProjectsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Projects">
      <ProjectsManagerPage roleBase="owner" canCreateProject />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}

