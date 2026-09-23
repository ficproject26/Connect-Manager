export const DEFAULT_TASKS = [
  {
    id: 'TSK-101',
    title: 'Physical KYC verification & store document audit',
    vendor: 'Sri Sai Provisions',
    category: 'KYC Verification',
    territory: 'Madurai',
    priority: 'High',
    status: 'In Progress',
    dueDate: 'Today, 5:00 PM',
    assignedTo: 'Field Officer Karthik',
    description: 'Verify original Aadhaar, PAN card, and trade license on-site. Capture geo-tagged shop front photo.'
  },
  {
    id: 'TSK-102',
    title: 'POS standee & QR merchant starter kit delivery',
    vendor: 'Anand Sweets',
    category: 'Kit Delivery',
    territory: 'Salem',
    priority: 'Medium',
    status: 'Pending',
    dueDate: 'Tomorrow, 12:00 PM',
    assignedTo: 'Pincode Executive Priya',
    description: 'Deliver welcome kit including Forge India QR soundbox, display standee, and merchant sticker pack.'
  },
  {
    id: 'TSK-103',
    title: 'Resolve GSTIN verification mismatch with merchant',
    vendor: 'Karthik Hardware',
    category: 'Merchant Support',
    territory: 'Krishnagiri',
    priority: 'Urgent',
    status: 'Pending',
    dueDate: '24 Sep 2026',
    assignedTo: 'District Field Manager',
    description: 'Collect updated GST certificate copy matching the registered legal trade name.'
  },
  {
    id: 'TSK-104',
    title: 'Store address geo-location recalibration visit',
    vendor: 'Royal Supermart',
    category: 'Territory Survey',
    territory: 'Chennai',
    priority: 'Low',
    status: 'Completed',
    dueDate: '20 Sep 2026',
    assignedTo: 'Zone Executive Murugan',
    description: 'Recalibrate GPS pinpoint coordinates for delivery routing on the customer app.'
  },
  {
    id: 'TSK-105',
    title: 'Bank account verification & IFSC confirmation',
    vendor: 'Meena Tex',
    category: 'Payout / Billing',
    territory: 'Coimbatore',
    priority: 'Medium',
    status: 'In Progress',
    dueDate: '25 Sep 2026',
    assignedTo: 'Division Manager',
    description: 'Confirm cancelled cheque copy and verify bank branch routing code for weekly payouts.'
  },
  {
    id: 'TSK-106',
    title: 'Merchant app training & first test transaction',
    vendor: 'Kavitha Silks & Sarees',
    category: 'Onboarding',
    territory: 'Tiruchirappalli',
    priority: 'High',
    status: 'Completed',
    dueDate: '19 Sep 2026',
    assignedTo: 'Pincode Executive',
    description: 'Walk merchant through order acceptance, catalog update, and daily settlement report view.'
  },
  {
    id: 'TSK-107',
    title: 'Inactive shop merchant follow-up visit',
    vendor: 'Sri Murugan Automobiles',
    category: 'Merchant Support',
    territory: 'Erode',
    priority: 'Medium',
    status: 'Pending',
    dueDate: '26 Sep 2026',
    assignedTo: 'Field Executive',
    description: 'Understand business bottlenecks and reactivate merchant inventory on Forge India platform.'
  }
];

export const getTaskStatusCounts = (tasks = DEFAULT_TASKS) => {
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const total = tasks.length;

  return { total, pending, inProgress, completed, open: pending + inProgress, openIssues: pending + inProgress, totalIssues: total };
};
