import OwnerShell from "@/components/dashboard/OwnerShell";
import { EstimateDashboardPage } from "@/components/dashboard/EstimateDashboardPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerNewEstimatePage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="New Estimate">
      <EstimateDashboardPage roleBase="owner" standalone />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
