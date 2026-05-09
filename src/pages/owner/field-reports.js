import OwnerShell from "@/components/dashboard/OwnerShell";
import { FieldReportsWorkspacePage } from "@/components/dashboard/Project/ProjectOperationsPanels";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerFieldReportsPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Field Reports">
      <FieldReportsWorkspacePage roleBase="owner" currentUserId={viewer.id} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
