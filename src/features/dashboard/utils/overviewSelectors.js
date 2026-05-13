export function buildDashboardOverviewAnalytics({ dashboardData, estimatesData, roleBase }) {
  const projectSummary = dashboardData?.summary?.projects ?? { total: 0, live: 0, complete: 0, onhold: 0 };
  const taskSummary = dashboardData?.summary?.tasks ?? {};
  const estimateList = estimatesData?.estimates ?? [];

  const draftEstimates = estimateList.filter((item) => (item.status || "draft") === "draft");
  const sentEstimates = estimateList.filter((item) => item.status === "sent");
  const approvedEstimates = estimateList.filter((item) => {
    const approvalStatus = String(item.approval_status || item.approvalStatus || item.status || "").toLowerCase();
    return approvalStatus === "approved";
  });
  const readyInvoices = approvedEstimates.filter((item) => !item.invoice_status);
  const draftInvoices = approvedEstimates.filter((item) => item.invoice_status === "draft");
  const completedInvoices = approvedEstimates.filter((item) => item.invoice_status === "completed");

  return {
    projectSummary,
    taskSummary,
    estimateList,
    draftEstimates,
    sentEstimates,
    approvedEstimates,
    readyInvoices,
    draftInvoices,
    completedInvoices,
    taskHeadlineValue:
      roleBase === "manager"
        ? taskSummary.assignedTasks?.assigned ?? 0
        : taskSummary.myTasks?.total ?? 0,
  };
}
