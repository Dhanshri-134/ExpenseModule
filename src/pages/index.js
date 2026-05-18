import DashboardShell from "@/components/dashboard/DashboardShell";
import EstimateDashboardPage from "@/components/dashboard/EstimateDashboardPage";
import { ExpenseIcon } from "@/components/dashboard/icons";
import { buildDashboardViewer } from "@/lib/dashboard";

export default function HomePage() {
  const matthew = buildDashboardViewer({
    id: "dev-matthew",
    name: "Matthew",
    email: "matthew@acm.local",
    userName: "mmcgee",
    userCode: "ACM-O-001",
    role: "owner",
    moduleAccess: { estimates: true },
    companyName: "ACM",
  });

  const navigation = [
    { href: "/owner/estimates/", label: "Estimates", icon: ExpenseIcon, match: /^\/owner\/estimates$/, moduleKey: "estimates" },
  ];

  return (
    <div className="relative min-h-screen">
      <DashboardShell companyName="ACM" navigation={navigation} viewer={matthew} title="Estimates">
        <EstimateDashboardPage roleBase="owner" />
      </DashboardShell>
    </div>
  );
}

