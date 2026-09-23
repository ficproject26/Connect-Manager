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

  // 6. Vendors
  console.log('Seeding Vendors...');
  const vendors = [
    {
      _id: 'ven_101',
      name: 'Rajesh Gupta',
      mobile: '9845012345',
      email: 'rajesh@spiceroute.com',
      businessName: 'Spice Route Bistro',
      category: 'Food & Beverage',
      subCategory: 'Fine Dining & Catering',
      description: 'Authentic South Indian multi-cuisine restaurant in Koramangala.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      panNumber: 'ABCDE1234F',
      gstNumber: '29ABCDE1234F1Z5',
      accountHolderName: 'Spice Route Bistro LLP',
      accountNumber: '50200012345678',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank, Koramangala',
      status: 'Active',
      statusNotes: 'All KYC documents and physical site inspection verified.',
      createdBy: 'user_pin_mgr1'
    },
    {
      _id: 'ven_102',
      name: 'Sunita Nair',
      mobile: '9845023456',
      email: 'sunita@nexustech.com',
      businessName: 'Nexus Tech Gadgets',
      category: 'Electronics & Retail',
      subCategory: 'Computer & Smartphone Accessories',
      description: 'Authorized retailer and repair hub for premium electronics.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      panNumber: 'FGHIJ5678K',
      gstNumber: '29FGHIJ5678K1Z2',
      accountHolderName: 'Nexus Tech Gadgets',
      accountNumber: '91802009876543',
      ifsc: 'ICIC0000456',
      bankName: 'ICICI Bank, Koramangala',
      status: 'Pending',
      statusNotes: 'Submitted for document inspection.',
      createdBy: 'user_pin_mgr2'
    },
    {
      _id: 'ven_103',
      name: 'Mohit Reddy',
      mobile: '9845034567',
      email: 'mohit@greenleaf.com',
      businessName: 'Green Leaf Organics',
      category: 'Grocery & Essentials',
      subCategory: 'Organic Farm Produce',
      description: 'Natural superfoods and organic farm vegetables.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      panNumber: 'KLMNO9012P',
      gstNumber: '29KLMNO9012P1Z8',
      accountHolderName: 'Green Leaf Organics',
      accountNumber: '60123456789012',
      ifsc: 'SBIN0004321',
      bankName: 'State Bank of India',
      status: 'Under Review',
      statusNotes: 'Under Review: Awaiting FSSAI certificate.',
      createdBy: 'user_pin_mgr1'
    },
    {
      _id: 'ven_104',
      name: 'Kavita Verma',
      mobile: '9845045678',
      email: 'kavita@apexauto.com',
      businessName: 'Apex Auto Care',
      category: 'Automotive',
      subCategory: 'Car Detailing & Diagnostics',
      description: 'Multi-brand vehicle servicing workshop.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      panNumber: 'PQRST3456U',
      gstNumber: '29PQRST3456U1Z9',
      accountHolderName: 'Apex Auto Care',
      accountNumber: '10987654321098',
      ifsc: 'KKBK0000123',
      bankName: 'Kotak Mahindra Bank',
      status: 'Rejected',
      statusNotes: 'GST certificate invalid.',
      createdBy: 'user_pin_mgr2'
    },
    {
      _id: 'ven_105',
      name: 'Deepak Jain',
      mobile: '9845056789',
      email: 'deepak@urbannest.com',
      businessName: 'Urban Nest Decor',
      category: 'Home & Living',
      subCategory: 'Teak Furniture',
      description: 'Modern handcrafted furniture for homes.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560034',
      panNumber: 'UVWXY7890Z',
      gstNumber: '29UVWXY7890Z1Z3',
      accountHolderName: 'Urban Nest Decor',
      accountNumber: '44556677889900',
      ifsc: 'AXIS0000789',
      bankName: 'Axis Bank',
      status: 'Inactive',
      statusNotes: 'Temporarily deactivated by vendor request.',
      createdBy: 'user_pin_mgr1'
    },
    {
      _id: 'ven_106',
      name: 'Arjun Swaminathan',
      mobile: '9845067890',
      email: 'arjun@dailybrew.com',
      businessName: 'Daily Brew Coffee Bar',
      category: 'Food & Beverage',
      subCategory: 'Specialty Coffee',
      description: 'Artisanal roastery and sourdough bakery in HSR Layout.',
      stateId: 'state_ka',
      districtId: 'dist_blr_u',
      divisionId: 'div_blr_s',
      pincodeId: 'pin_560095',
      panNumber: 'BCDEF2345G',
      gstNumber: '29BCDEF2345G1Z4',
      accountHolderName: 'Daily Brew LLP',
      accountNumber: '33445566778899',
      ifsc: 'HDFC0004567',
      bankName: 'HDFC Bank, HSR Sector 2',
      status: 'Active',
      statusNotes: 'Operational in Bengaluru South.',
      createdBy: 'user_div_mgr1'
    },
    {
      _id: 'ven_107',
      name: 'Govind Murthy',
      mobile: '9845090123',
      email: 'govind@mysoremart.com',
      businessName: 'Mysore Sandal Mart',
      category: 'Retail & Handicrafts',
      subCategory: 'Sandalwood Artifacts',
      description: 'Authentic Mysore sandalwood extracts and crafts.',
      stateId: 'state_ka',
      districtId: 'dist_mys',
      divisionId: 'div_mys_u',
      pincodeId: 'pin_570001',
      panNumber: 'EFGHI5678J',
      gstNumber: '29EFGHI5678J1Z0',
      accountHolderName: 'Mysore Mart Corp',
      accountNumber: '77665544332211',
      ifsc: 'BARB0MYSORE',
      bankName: 'Bank of Baroda',
      status: 'Active',
      statusNotes: 'Mysuru district verified in Karnataka.',
      createdBy: 'user_dist_mgr1'
    }
  ];
  await db.vendors.insertMany(vendors);

  // 7. Initial Audit Logs
  const auditLogs = [
    {
      userId: 'user_pin_mgr1',
      userName: 'Ananya Desai',
      userRole: 'pincode_manager',
      action: 'Vendor Created',
      module: 'Vendors',
      recordId: 'ven_101',
      previousValue: null,
      newValue: { businessName: 'Spice Route Bistro', status: 'Pending' },
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ];
  await db.auditLogs.insertMany(auditLogs);

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
