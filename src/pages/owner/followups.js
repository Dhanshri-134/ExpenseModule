import OwnerShell from "@/components/dashboard/OwnerShell";
import FollowUpsPage from "@/components/dashboard/FollowUpsPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerFollowUpsRoute({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Follow-ups">
      <FollowUpsPage roleBase="owner" />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
