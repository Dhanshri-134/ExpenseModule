import OwnerShell from "@/components/dashboard/OwnerShell";
import { FlowPlaceholderPage } from "@/components/dashboard/FlowPlaceholderPage";
import { requireOwner } from "@/lib/pages/requireOwner";

export default function OwnerInvoicingPage({ companyName, viewer }) {
  return (
    <OwnerShell companyName={companyName} viewer={viewer} title="Invoicing">
      <FlowPlaceholderPage
        title="Invoicing Flow"
        description="This stage is now placed after Estimates and before Projects in the owner dashboard flow. The project dashboard itself remains unchanged for now."
      />
    </OwnerShell>
  );
}

export async function getServerSideProps(ctx) {
  return requireOwner(ctx);
}
