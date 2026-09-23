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

  // 1. Pan-India Location Hierarchy (36 States/UTs, 4 Zones, Districts, Divisions, PIN Codes)
  const locationData = require('./locationData');
  console.log(`Seeding ${locationData.states.length} States/UTs, ${locationData.districts.length} Districts (with North/South/East/West zones), ${locationData.divisions.length} Divisions, ${locationData.pincodes.length} PIN Codes...`);
  await db.states.insertMany(locationData.states);
  await db.districts.insertMany(locationData.districts);
  await db.divisions.insertMany(locationData.divisions);
  await db.pincodes.insertMany(locationData.pincodes);

  // 5. Manager Accounts
  // Rule:
  // - 4 State Agent Managers per State
  // - 2 District Agent Managers per District
  // - 2 Division Agent Managers per Division
  // - 2 Pincode Agent Managers per Pincode
  console.log('Seeding System Administrator account...');
  const adminHash = await bcrypt.hash('admin123', 10);

  const users = [
    // --- SYSTEM ADMINISTRATOR / STATE MANAGER ---
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
    }
  ];
  await db.users.insertMany(users);

  // 6. Vendors and Audit Logs kept clean for live data
  console.log('Vendors and Audit logs initialized as clean empty datastores.');

  console.log('✅ Database successfully initialized with clean state and System Administrator account!');
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
