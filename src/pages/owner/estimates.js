import OwnerShell from "@/components/dashboard/OwnerShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerEstimatesPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Estimates">
      <EstimateDashboardPage roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
