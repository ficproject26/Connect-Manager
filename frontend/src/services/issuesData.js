export const DEFAULT_ISSUES = [];


export const getIssueStatusCounts = (issues = DEFAULT_ISSUES) => {
  const open = issues.filter(i => i.status === 'Open').length;
  const inProgress = issues.filter(i => i.status === 'In Progress').length;
  const escalated = issues.filter(i => i.status === 'Escalated').length;
  const resolved = issues.filter(i => i.status === 'Resolved').length;
  const total = issues.length;

  return { total, open, inProgress, escalated, resolved };
};
