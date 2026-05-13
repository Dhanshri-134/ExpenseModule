export function buildExpenseMetrics(expenses = [], projects = []) {
  const totalAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const typeMap = new Map();
  const monthlyMap = new Map();
  const projectSpendMap = new Map();

  (projects ?? []).forEach((project) => {
    projectSpendMap.set(project.id, {
      id: project.id,
      name: project.name || "Project",
      jobNumber: project.job_number || "",
      budget: Number(project.contract_value || 0),
      spent: 0,
      remaining: Number(project.contract_value || 0),
    });
  });

  expenses.forEach((expense) => {
    const amount = Number(expense.amount || 0);
    const typeLabel = expense.expense_type || expense.category || "expense";
    typeMap.set(typeLabel, (typeMap.get(typeLabel) || 0) + amount);
    const monthKey = String(expense.expense_date || "").slice(0, 7);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
    const projectId = expense.project_id;
    const existingProject = projectSpendMap.get(projectId) || {
      id: projectId,
      name: expense.project?.name || "Project",
      jobNumber: expense.project?.job_number || "",
      budget: Number(expense.project?.contract_value || 0),
      spent: 0,
      remaining: Number(expense.project?.contract_value || 0),
    };
    existingProject.spent += amount;
    existingProject.remaining = existingProject.budget - existingProject.spent;
    projectSpendMap.set(projectId, existingProject);
  });

  const totalBudget = Array.from(projectSpendMap.values()).reduce((sum, item) => sum + Number(item.budget || 0), 0);
  const remainingBudget = totalBudget - totalAmount;

  return {
    totalAmount,
    totalBudget,
    remainingBudget,
    budgetUsedPercent: totalBudget > 0 ? (totalAmount / totalBudget) * 100 : 0,
    totalEntries: expenses.length,
    averageAmount: expenses.length ? totalAmount / expenses.length : 0,
    topCategories: Array.from(typeMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    monthlySpend: Array.from(monthlyMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-6),
    projectSummaries: Array.from(projectSpendMap.values())
      .sort((a, b) => b.spent - a.spent),
  };
}

export function buildEnteredByOptions(expenses = []) {
  const map = new Map();
  expenses.forEach((expense) => {
    if (!expense.created_by_user_id) return;
    map.set(
      expense.created_by_user_id,
      expense.created_by?.name || expense.created_by?.user_name || expense.created_by?.user_code || "Team Member"
    );
  });
  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}
