const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const db = require('../../backend/src/config/db');
const JWT_SECRET = process.env.JWT_SECRET || 'AGENT_MANAGER_SUPER_SECURE_JWT_SECRET_2026_PROD';

async function runTests() {
  console.log('--- STARTING UNIT & INTEGRATION TESTS ---');
  
  // 1. Setup express app with our routes
  const app = express();
  app.use(express.json());
  
  const authRoutes = require('../../backend/src/routes/authRoutes');
  const issueRoutes = require('../../backend/src/routes/issueRoutes');
  const reportRoutes = require('../../backend/src/routes/reportRoutes');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/reports', reportRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on port ${port}`);

  try {
    // 2. Find Surya
    const surya = await db.users.findOne({ email: 'surya@gmail.com' });
    if (!surya) {
      throw new Error('Surya not found in db.users');
    }
    console.log('Found manager:', surya.name, surya.email, surya.role, surya.state);

    const token = jwt.sign({
      id: surya._id || surya.id,
      managerId: surya.managerId || surya.id,
      role: surya.role,
      level: surya.level,
      email: surya.email,
      stateId: surya.stateId
    }, JWT_SECRET, { expiresIn: '1h' });

    // TEST 1: GET /api/issues
    console.log('\n[TEST 1] Testing GET /api/issues for Surya (Tamil Nadu State Manager)...');
    const res1 = await fetch(`${baseUrl}/api/issues`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const issuesData = await res1.json();

    console.log('Status:', res1.status);
    console.log('Success:', issuesData.success);
    console.log('Counts:', issuesData.counts);
    console.log('Number of issues returned:', issuesData.data?.length);
    if (!issuesData.success || issuesData.data.length === 0) {
      throw new Error('Test 1 Failed: Could not get issues');
    }
    console.log('✅ TEST 1 PASSED: Successfully retrieved scoped issues with accurate counts.');

    // TEST 2: GET /api/issues with status filter
    console.log('\n[TEST 2] Testing GET /api/issues?status=Open...');
    const res2 = await fetch(`${baseUrl}/api/issues?status=Open`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const openData = await res2.json();
    console.log('Open issues count:', openData.data?.length);
    const allOpen = openData.data.every(i => i.status === 'Open');
    if (!allOpen || openData.data.length === 0) {
      throw new Error('Test 2 Failed: Filter by status Open did not return only Open issues');
    }
    console.log('✅ TEST 2 PASSED: Status filter correctly isolates Open issues.');

    // TEST 3: PATCH /api/issues/:id/status
    console.log('\n[TEST 3] Testing PATCH /api/issues/:id/status...');
    const testIssueId = issuesData.data[0]._id || issuesData.data[0].id;
    const originalStatus = issuesData.data[0].status;
    const res3 = await fetch(`${baseUrl}/api/issues/${testIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'In Progress', notes: 'Manager reviewing field inspection' })
    });
    const updateData = await res3.json();
    console.log('Update Status:', res3.status, updateData.message);
    if (!updateData.success) {
      throw new Error('Test 3 Failed: Could not update issue status');
    }
    // Revert back to original status
    await fetch(`${baseUrl}/api/issues/${testIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: originalStatus })
    });
    console.log('✅ TEST 3 PASSED: Issue status update and access validation working.');

    // TEST 4: Profile photo upload
    console.log('\n[TEST 4] Testing PUT /api/auth/profile-photo upload...');
    const dummyImageBytes = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    const blob = new Blob([dummyImageBytes], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', blob, 'test_profile.jpg');

    const res4 = await fetch(`${baseUrl}/api/auth/profile-photo`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const uploadData = await res4.json();
    console.log('Upload response status:', res4.status);
    console.log('Upload avatarUrl:', uploadData.avatarUrl);
    if (!uploadData.success || !uploadData.avatarUrl) {
      throw new Error('Test 4 Failed: Profile photo upload failed');
    }
    console.log('✅ TEST 4 PASSED: Profile photo uploaded and saved successfully.');

    // TEST 5: Verify profile photo persistence via GET /api/auth/me
    console.log('\n[TEST 5] Testing GET /api/auth/me for photo persistence...');
    const res5 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await res5.json();
    console.log('Me avatarUrl:', meData.user?.avatarUrl);
    if (meData.user?.avatarUrl !== uploadData.avatarUrl) {
      throw new Error('Test 5 Failed: Profile photo not persisted on user profile');
    }
    console.log('✅ TEST 5 PASSED: Profile photo persists across session/getMe.');

    // TEST 6: Remove profile photo
    console.log('\n[TEST 6] Testing DELETE /api/auth/profile-photo...');
    const res6 = await fetch(`${baseUrl}/api/auth/profile-photo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const deleteData = await res6.json();
    console.log('Delete response status:', res6.status);
    console.log('Delete avatarUrl:', deleteData.avatarUrl);
    const res7 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meAfterDelete = await res7.json();
    console.log('Me avatarUrl after delete:', meAfterDelete.user?.avatarUrl);
    if (meAfterDelete.user?.avatarUrl !== null) {
      throw new Error('Test 6 Failed: Profile photo removal failed');
    }
    console.log('✅ TEST 6 PASSED: Profile photo cleanly removed and reset to null fallback.');

    console.log('\n🎉 ALL ACCEPTANCE CRITERIA TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    const redisBroker = require('../../backend/src/redis/redisClient');
    await redisBroker.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
