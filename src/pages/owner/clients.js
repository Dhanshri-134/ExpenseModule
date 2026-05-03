import OwnerShell from "@/components/dashboard/OwnerShell";
import { ClientsManagerPage } from "@/components/dashboard/DashboardClientPages";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerClientsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Clients">
      <ClientsManagerPage roleBase="owner" canCreateClient />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
