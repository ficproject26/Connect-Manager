const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seedData() {
  console.log('Seeding Agent Manager hierarchy according to exact role specifications...');
  await db.states.clear();
  await db.districts.clear();
  await db.divisions.clear();
  await db.pincodes.clear();
  await db.users.clear();
  await db.vendors.clear();
  await db.auditLogs.clear();
  await db.tasks.clear();
  await db.shopVisits.clear();
  await db.submittedReports.clear();
  await db.agents.clear();
  await db.notifications.clear();
  await db.settings.clear();

  // 1. Pan-India Location Hierarchy (36 States/UTs, 4 Zones, Districts, Divisions, PIN Codes)
  const locationData = require('./locationData');
  console.log(`Seeding ${locationData.states.length} States/UTs, ${locationData.districts.length} Districts (with North/South/East/West zones), ${locationData.divisions.length} Divisions, ${locationData.pincodes.length} PIN Codes...`);
  await db.states.insertMany(locationData.states);
  await db.districts.insertMany(locationData.districts);
  await db.divisions.insertMany(locationData.divisions);
  await db.pincodes.insertMany(locationData.pincodes);

  // 2. Manager Accounts
  console.log('Seeding Manager accounts across 4 hierarchy tiers...');
  const adminHash = await bcrypt.hash('admin123', 10);
  const passHash = await bcrypt.hash('Password@123', 10);

  const users = [
    {
      _id: 'user_admin',
      name: 'System Administrator',
      email: 'admin@example.com',
      mobile: '9999999999',
      passwordHash: adminHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_state_1',
      name: 'Ramesh Kumar',
      email: 'state.mgr1@example.com',
      mobile: '9888800001',
      passwordHash: passHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_dist_1',
      name: 'Priya Sharma',
      email: 'dist.mgr1@example.com',
      mobile: '9888800002',
      passwordHash: passHash,
      role: 'district_manager',
      level: 2,
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_div_1',
      name: 'Anand Patil',
      email: 'div.mgr1@example.com',
      mobile: '9888800003',
      passwordHash: passHash,
      role: 'division_manager',
      level: 3,
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: 'div_blr_south',
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_pin_1',
      name: 'Deepa Rao',
      email: 'pin.mgr1@example.com',
      mobile: '9888800004',
      passwordHash: passHash,
      role: 'pincode_manager',
      level: 4,
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560034',
      status: 'active'
    }
  ];
  await db.users.insertMany(users);

  // 3. Operational Field Agents
  console.log('Seeding initial operational field agents...');
  const agents = [
    {
      _id: 'agent_01',
      name: 'Suresh Gowda',
      mobile: '9845012345',
      email: 'suresh.gowda@agent.forgeconnect.in',
      role: 'State Verification Agent',
      level: 1,
      status: 'Active',
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560034',
      pincodeCode: '560034',
      area: 'Koramangala 4th Block',
      onboardedVendorsCount: 42,
      totalCommissionEarned: 18900,
      kycVerified: true,
      joiningDate: '2026-01-15T09:00:00.000Z',
      managerId: 'user_admin'
    },
    {
      _id: 'agent_02',
      name: 'Kavitha N',
      mobile: '9845067890',
      email: 'kavitha.n@agent.forgeconnect.in',
      role: 'District Operations Agent',
      level: 2,
      status: 'Active',
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560034',
      pincodeCode: '560034',
      area: 'Koramangala 6th Block',
      onboardedVendorsCount: 28,
      totalCommissionEarned: 12600,
      kycVerified: true,
      joiningDate: '2026-02-01T10:30:00.000Z',
      managerId: 'user_dist_1'
    },
    {
      _id: 'agent_03',
      name: 'Manjunath Swamy',
      mobile: '9845099887',
      email: 'manjunath.s@agent.forgeconnect.in',
      role: 'Pincode Field Agent',
      level: 4,
      status: 'Active',
      stateId: 'state_ka',
      districtId: 'dist_bengaluru_urban',
      divisionId: 'div_blr_south',
      pincodeId: 'pin_560034',
      pincodeCode: '560034',
      area: 'Koramangala 8th Block',
      onboardedVendorsCount: 15,
      totalCommissionEarned: 6750,
      kycVerified: true,
      joiningDate: '2026-03-10T11:15:00.000Z',
      managerId: 'user_pin_1'
    }
  ];
  await db.agents.insertMany(agents);

  // 4. Initial Operational QC Tasks
  console.log('Seeding initial operational & QC tasks...');
  const tasks = [
    {
      _id: 'task_001',
      taskNumber: 'TSK-100234',
      vendor: 'Sri Lakshmi Provision Store',
      category: 'Physical QC Audit',
      priority: 'High',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'Assigned',
      assignedManagerId: 'user_pin_1',
      assignedManagerName: 'Deepa Rao',
      assignedManagerRole: 'pincode_manager',
      createdByAdminName: 'System Administrator',
      createdByAdminRole: 'state_manager',
      description: 'Conduct on-site shop verification, check signage display, and verify GST certificate.',
      remarks: 'High volume grocery merchant located near 80ft Road.',
      location: 'Koramangala, Bengaluru Urban',
      pincode: '560034',
      pincodeId: 'pin_560034',
      divisionId: 'div_blr_south',
      districtId: 'dist_bengaluru_urban',
      stateId: 'state_ka',
      photos: [],
      shopPhoto: null,
      reworkDetails: null,
      completionDetails: null
    },
    {
      _id: 'task_002',
      taskNumber: 'TSK-100235',
      vendor: 'Balaji Electricals & Hardware',
      category: 'QR Code Delivery & Verification',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
      status: 'In Progress',
      assignedManagerId: 'user_pin_1',
      assignedManagerName: 'Deepa Rao',
      assignedManagerRole: 'pincode_manager',
      createdByAdminName: 'Priya Sharma',
      createdByAdminRole: 'district_manager',
      description: 'Deliver official acrylic standee and dynamic merchant soundbox.',
      remarks: 'Merchant completed digital KYC yesterday.',
      location: 'Koramangala, Bengaluru Urban',
      pincode: '560034',
      pincodeId: 'pin_560034',
      divisionId: 'div_blr_south',
      districtId: 'dist_bengaluru_urban',
      stateId: 'state_ka',
      photos: [],
      shopPhoto: null,
      reworkDetails: null,
      completionDetails: null
    }
  ];
  await db.tasks.insertMany(tasks);

  // 5. Initial System Settings
  await db.settings.insertOne({
    userId: 'user_admin',
    emailAlerts: true,
    kycAlerts: true,
    statusChangeAlerts: true,
    dailyDigest: true,
    theme: 'light',
    autoAssignTasks: true,
    territoryAlertRadiusKm: 15
  });

  console.log('✅ Database successfully initialized with all relational collections!');
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = seedData;
