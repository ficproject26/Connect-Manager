export const DEFAULT_ISSUES = [
  { id: 'ISS-401', title: 'Payment settlement delay', vendor: 'Sri Sai Provisions', territory: 'Madurai', priority: 'High', status: 'Escalated', reportedAt: '2 hours ago' },
  { id: 'ISS-398', title: 'KYC Document blur issue', vendor: 'Anand Sweets', territory: 'Salem', priority: 'Medium', status: 'In Progress', reportedAt: '4 hours ago' },
  { id: 'ISS-392', title: 'GSTIN mismatch during verification', vendor: 'Karthik Hardware', territory: 'Krishnagiri', priority: 'High', status: 'Open', reportedAt: 'Yesterday' },
  { id: 'ISS-385', title: 'Store address geo-location recalibration', vendor: 'Royal Supermart', territory: 'Chennai', priority: 'Low', status: 'Resolved', reportedAt: '2 days ago' },
  { id: 'ISS-380', title: 'Bank IFSC routing validation fail', vendor: 'Meena Tex', territory: 'Coimbatore', priority: 'Medium', status: 'In Progress', reportedAt: '3 days ago' }
];

export const getIssueStatusCounts = (issues = DEFAULT_ISSUES) => {
  const open = issues.filter(i => i.status === 'Open').length;
  const inProgress = issues.filter(i => i.status === 'In Progress').length;
  const escalated = issues.filter(i => i.status === 'Escalated').length;
  const resolved = issues.filter(i => i.status === 'Resolved').length;
  const total = issues.length;

  return { total, open, inProgress, escalated, resolved };
};
