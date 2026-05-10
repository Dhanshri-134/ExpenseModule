import OwnerShell from "@/components/dashboard/OwnerShell";
import TimeTrackingPage from "@/components/dashboard/TimeTrackingPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerTimeTrackingRoute({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Time Tracking">
      <TimeTrackingPage roleBase="owner" currentUserId={viewer.id} />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
