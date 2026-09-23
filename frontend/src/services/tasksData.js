export const DEFAULT_TASKS = [];

export const getTaskStatusCounts = (tasks = DEFAULT_TASKS) => {
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const total = tasks.length;

  return { total, pending, inProgress, completed, open: pending + inProgress, openIssues: pending + inProgress, totalIssues: total };
};
