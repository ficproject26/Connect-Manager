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
  console.log('Seeding 4 State Managers, 2 District Managers, 2 Division Managers, 2 Pincode Managers...');
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
    },
    // --- 4 STATE AGENT MANAGERS (KARNATAKA) ---
    {
      _id: 'user_state_mgr1',
      name: 'Ramesh Kumar',
      email: 'state.mgr1@example.com',
      mobile: '9876543210',
      passwordHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_state_mgr2',
      name: 'Divya Kulkarni',
      email: 'state.mgr2@example.com',
      mobile: '9876543214',
      passwordHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_state_mgr3',
      name: 'Vijay Jadhav',
      email: 'state.mgr3@example.com',
      mobile: '9876543215',
      passwordHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_state_mgr4',
      name: 'Sneha Biradar',
      email: 'state.mgr4@example.com',
      mobile: '9876543216',
      passwordHash,
      role: 'state_manager',
      level: 1,
      stateId: 'state_ka',
      districtId: null,
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },

    // --- 2 DISTRICT AGENT MANAGERS (BENGALURU URBAN) ---
    {
      _id: 'user_dist_mgr1',
      name: 'Priya Rao',
      email: 'dist.mgr1@example.com',
      mobile: '9876543211',
      passwordHash,
      role: 'district_manager',
      level: 2,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_dist_mgr2',
      name: 'Ramesh Sen',
      email: 'dist.mgr2@example.com',
      mobile: '9876543221',
      passwordHash,
      role: 'district_manager',
      level: 2,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: null,
      pincodeId: null,
      status: 'active'
    },

    // --- 2 DIVISION AGENT MANAGERS (BENGALURU SOUTH) ---
    {
      _id: 'user_div_mgr1',
      name: 'Vikram Kumar',
      email: 'div.mgr1@example.com',
      mobile: '9876543212',
      passwordHash,
      role: 'division_manager',
      level: 3,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: null,
      status: 'active'
    },
    {
      _id: 'user_div_mgr2',
      name: 'Suman Joshi',
      email: 'div.mgr2@example.com',
      mobile: '9876543222',
      passwordHash,
      role: 'division_manager',
      level: 3,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: null,
      status: 'active'
    },

    // --- 2 PINCODE AGENT MANAGERS (PIN 560034 KORAMANGALA) ---
    {
      _id: 'user_pin_mgr1',
      name: 'Ananya Desai',
      email: 'pin.mgr1@example.com',
      mobile: '9876543213',
      passwordHash,
      role: 'pincode_manager',
      level: 4,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      status: 'active'
    },
    {
      _id: 'user_pin_mgr2',
      name: 'Karthik Nair',
      email: 'pin.mgr2@example.com',
      mobile: '9876543223',
      passwordHash,
      role: 'pincode_manager',
      level: 4,
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      status: 'active'
    }
  ];
  await db.users.insertMany(users);

  // 6. Vendors and Audit Logs kept clean for live data
  console.log('Vendors and Audit logs initialized as clean empty datastores.');

  console.log('✅ Database successfully seeded with 4 State, 2 District, 2 Division, and 2 Pincode Managers!');
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
