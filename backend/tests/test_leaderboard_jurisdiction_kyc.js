const path = require('path');
const fs = require('fs');
const db = require('../src/config/db');
const reportController = require('../src/controllers/reportController');
const authController = require('../src/controllers/authController');

(async () => {
  console.log('========================================================================');
  console.log('🧪 VERIFYING: LEADERBOARD FILTERING, JURISDICTION SCOPING & MANDATORY KYC UPLOADS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  ✅ PASS: ' + message);
      passed++;
    } else {
      console.error('  ❌ FAIL: ' + message);
      failed++;
    }
  }

  const mockReqRes = (user, query = {}, body = {}) => {
    return new Promise((resolve) => {
      const req = {
        user: {
          _id: String(user?._id || user?.id || ''),
          id: String(user?._id || user?.id || ''),
          name: user?.name,
          email: user?.email,
          role: user?.role,
          level: user?.level,
          stateId: user?.stateId,
          state: user?.state || user?.stateName,
          stateName: user?.state || user?.stateName,
          districtId: user?.districtId,
          district: user?.district || user?.districtName,
          districtName: user?.district || user?.districtName,
          divisionId: user?.divisionId,
          division: user?.division || user?.divisionName,
          divisionName: user?.division || user?.divisionName,
          pincodeId: user?.pincodeId,
          pincode: user?.pincode || user?.pincodeCode,
          pincodeCode: user?.pincode || user?.pincodeCode
        },
        query,
        body
      };
      const res = {
        status: (code) => ({
          json: (data) => resolve({ status: code, data }),
          send: (data) => resolve({ status: code, data })
        }),
        json: (data) => resolve({ status: 200, data })
      };
      return { req, res };
    });
  };

  const users = await db.users.find();
  const mgrs = db.managers ? await db.managers.find() : [];
  const allUsers = [...users, ...mgrs];

  const surya = allUsers.find(u => (u.name || '').toLowerCase() === 'surya');
  const balavignesh = allUsers.find(u => (u.name || '').toLowerCase().includes('balavignesh'));
  const vennila = allUsers.find(u => (u.name || '').toLowerCase() === 'vennila');
  const muruga = allUsers.find(u => (u.name || '').toLowerCase() === 'muruga');
  const superman = allUsers.find(u => (u.name || '').toLowerCase() === 'superman');
  const iniya = allUsers.find(u => (u.name || '').toLowerCase() === 'iniya');

  console.log('--- 1. LEADERBOARD DIVISION & PINCODE FILTERING TESTS ---');

  // Test 1: Leaderboard for Division Managers (must include both Balavignesh and Vennila)
  {
    const { req, res } = await new Promise((resolve) => {
      const req = { user: surya || balavignesh, query: { tier: 'division_manager', period: 'month' } };
      const res = {
        status: (code) => ({ json: (data) => resolve({ req, res: { status: code, data } }) }),
        json: (data) => resolve({ req, res: { status: 200, data } })
      };
      reportController.getLeaderboardData(req, res);
    });

    const resObj = res.data;
    assert(resObj.success === true, 'getLeaderboardData returned success: true');
    const rankings = resObj.data || [];
    console.log(`     Total managers in leaderboard: ${rankings.length}`);

    const divisionManagers = rankings.filter(r => (r.role || '').toLowerCase().includes('division'));
    const balaInDiv = divisionManagers.find(m => (m.name || '').toLowerCase().includes('balavignesh'));
    const vennilaInDiv = divisionManagers.find(m => (m.name || '').toLowerCase().includes('vennila'));

    assert(Boolean(balaInDiv), 'Balavignesh is present in Division tier ranking');
    assert(Boolean(vennilaInDiv), 'Vennila is present in Division tier ranking (ACTIVE Division Manager)');

    const pincodeManagers = rankings.filter(r => (r.role || '').toLowerCase().includes('pincode'));
    const murugaInPin = pincodeManagers.find(m => (m.name || '').toLowerCase().includes('muruga'));
    const superInPin = pincodeManagers.find(m => (m.name || '').toLowerCase().includes('superman'));

    assert(Boolean(murugaInPin), 'Muruga is present in Pincode tier ranking');
    assert(Boolean(superInPin), 'Superman is present in Pincode tier ranking');
  }

  // Test 2: Leaderboard period filter support (month, quarter, year)
  {
    const periods = ['month', 'quarter', 'year'];
    for (const p of periods) {
      const { res } = await new Promise((resolve) => {
        const req = { user: surya, query: { period: p } };
        const res = {
          status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
          json: (data) => resolve({ res: { status: 200, data } })
        };
        reportController.getLeaderboardData(req, res);
      });
      assert(res.data.success === true && Array.isArray(res.data.data), `Leaderboard period filter '${p}' executed successfully`);
    }
  }

  console.log('\n--- 2. ASSIGNED JURISDICTION SCOPING TESTS ---');

  // Test 3: State Manager (Surya) jurisdiction scoping
  {
    const { res } = await new Promise((resolve) => {
      const req = { user: surya };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.getMe(req, res);
    });

    const userScope = res.data?.user?.scope;
    const userTerritory = res.data?.user?.territory;
    assert(Boolean(userScope?.stateName), 'State Manager scope contains stateName');
    assert(userScope?.districtName === null, 'State Manager scope districtName is strictly null');
    assert(userScope?.divisionName === null, 'State Manager scope divisionName is strictly null');
    assert(userScope?.pincodeCode === null, 'State Manager scope pincodeCode is strictly null');
    assert(userTerritory?.district === null, 'State Manager territory district is strictly null');
    assert(userTerritory?.division === null, 'State Manager territory division is strictly null');
    assert(userTerritory?.pincode === null, 'State Manager territory pincode is strictly null');
  }

  // Test 4: District Manager (Iniya) jurisdiction scoping
  if (iniya) {
    const { res } = await new Promise((resolve) => {
      const req = { user: iniya };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.getMe(req, res);
    });

    const userScope = res.data?.user?.scope;
    assert(Boolean(userScope?.stateName), 'District Manager scope contains stateName');
    assert(Boolean(userScope?.districtName), 'District Manager scope contains districtName');
    assert(userScope?.divisionName === null, 'District Manager scope divisionName is strictly null');
    assert(userScope?.pincodeCode === null, 'District Manager scope pincodeCode is strictly null');
  }

  // Test 5: Division Manager (Vennila) jurisdiction scoping
  if (vennila) {
    const { res } = await new Promise((resolve) => {
      const req = { user: vennila };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.getMe(req, res);
    });

    const userScope = res.data?.user?.scope;
    assert(Boolean(userScope?.stateName), 'Division Manager scope contains stateName');
    assert(Boolean(userScope?.districtName), 'Division Manager scope contains districtName');
    assert(Boolean(userScope?.divisionName), 'Division Manager scope contains divisionName');
    assert(userScope?.pincodeCode === null, 'Division Manager scope pincodeCode is strictly null');
  }

  console.log('\n--- 3. MANDATORY KYC DOCUMENT UPLOADS TESTS ---');

  const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Create temporary test document files in uploads
  const testAadhaar = 'test_aadhaar_sample.pdf';
  const testPan = 'test_pan_sample.jpg';
  const testBank = 'test_bank_sample.png';
  const testSig = 'test_sig_sample.png';

  fs.writeFileSync(path.join(UPLOAD_DIR, testAadhaar), 'MOCK_AADHAAR_PDF_CONTENT');
  fs.writeFileSync(path.join(UPLOAD_DIR, testPan), 'MOCK_PAN_JPG_CONTENT');
  fs.writeFileSync(path.join(UPLOAD_DIR, testBank), 'MOCK_BANK_PNG_CONTENT');
  fs.writeFileSync(path.join(UPLOAD_DIR, testSig), 'MOCK_SIG_PNG_CONTENT');

  const baseRegPayload = {
    name: 'Karthik Raja',
    email: `karthik_test_${Date.now()}@example.com`,
    mobile: '9876543210',
    password: 'Password@123',
    role: 'pincode_manager',
    declarationAccepted: true,
    bankDetails: {
      accountHolderName: 'Karthik Raja',
      bankName: 'State Bank of India',
      branchName: 'Chennai Main',
      city: 'Chennai',
      accountNumber: '123456789012',
      ifscCode: 'SBIN0001234'
    }
  };

  // Test 6: Registration fails when documents object is missing
  {
    const { res } = await new Promise((resolve) => {
      const req = { body: { ...baseRegPayload, documents: null } };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.register(req, res);
    });
    assert(res.status === 400 && res.data.success === false, 'Registration fails when documents are missing (HTTP 400)');
  }

  // Test 7: Registration fails when one of the 4 documents is missing
  {
    const { res } = await new Promise((resolve) => {
      const req = {
        body: {
          ...baseRegPayload,
          documents: {
            aadharUrl: `/uploads/${testAadhaar}`,
            panUrl: `/uploads/${testPan}`,
            bankUrl: `/uploads/${testBank}`
            // signatureUrl is missing!
          }
        }
      };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.register(req, res);
    });
    assert(res.status === 400 && res.data.message.includes('Signature'), 'Registration fails when Digital Signature is missing');
  }

  // Test 8: Registration fails when document points to non-existent storage file (no mock fallbacks)
  {
    const { res } = await new Promise((resolve) => {
      const req = {
        body: {
          ...baseRegPayload,
          documents: {
            aadharUrl: `/uploads/non_existent_fake_file_${Date.now()}.pdf`,
            panUrl: `/uploads/${testPan}`,
            bankUrl: `/uploads/${testBank}`,
            signatureUrl: `/uploads/${testSig}`
          }
        }
      };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.register(req, res);
    });
    assert(res.status === 400 && res.data.message.includes('not found in storage'), 'Registration rejects fake/unuploaded file path with 400');
  }

  // Test 9: Registration fails when document has invalid format (e.g., .txt, .exe)
  {
    const invalidFile = 'invalid_format.txt';
    fs.writeFileSync(path.join(UPLOAD_DIR, invalidFile), 'INVALID_FILE_CONTENT');
    const { res } = await new Promise((resolve) => {
      const req = {
        body: {
          ...baseRegPayload,
          documents: {
            aadharUrl: `/uploads/${invalidFile}`,
            panUrl: `/uploads/${testPan}`,
            bankUrl: `/uploads/${testBank}`,
            signatureUrl: `/uploads/${testSig}`
          }
        }
      };
      const res = {
        status: (code) => ({ json: (data) => resolve({ res: { status: code, data } }) }),
        json: (data) => resolve({ res: { status: 200, data } })
      };
      authController.register(req, res);
    });
    assert(res.status === 400 && res.data.message.includes('invalid format'), 'Registration rejects disallowed document formats (.txt) with 400');
    try { fs.unlinkSync(path.join(UPLOAD_DIR, invalidFile)); } catch (e) {}
  }

  // Clean up temporary test files
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, testAadhaar));
    fs.unlinkSync(path.join(UPLOAD_DIR, testPan));
    fs.unlinkSync(path.join(UPLOAD_DIR, testBank));
    fs.unlinkSync(path.join(UPLOAD_DIR, testSig));
  } catch (e) {}

  console.log('\n========================================================================');
  console.log(`🏁 TEST EXECUTION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
})();
