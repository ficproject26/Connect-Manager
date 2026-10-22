const db = require('../config/db');

// GET /api/settings - Retrieve manager portal settings
const getSettings = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || user?.managerId || 'mgr_default');
    let settings = await db.settings.findOne({
      $or: [{ userId: uid }, { userId: user?.id }, { userId: user?._id }]
    });

    if (!settings) {
      settings = await db.settings.insertOne({
        userId: uid,
        emailAlerts: true,
        kycAlerts: true,
        statusChangeAlerts: true,
        dailyDigest: true,
        theme: 'light',
        autoAssignTasks: true,
        territoryAlertRadiusKm: 15
      });
    }

    res.json({
      success: true,
      data: settings,
      settings
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve settings' });
  }
};

// PUT /api/settings - Update manager portal settings
const updateSettings = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || user?.managerId || 'mgr_default');
    const { emailAlerts, kycAlerts, statusChangeAlerts, dailyDigest, theme, autoAssignTasks, territoryAlertRadiusKm } = req.body;

    let existing = await db.settings.findOne({
      $or: [{ userId: uid }, { userId: user?.id }, { userId: user?._id }]
    });

    let updated;
    if (existing) {
      updated = await db.settings.findByIdAndUpdate(existing._id, {
        $set: {
          emailAlerts: emailAlerts !== undefined ? emailAlerts : existing.emailAlerts,
          kycAlerts: kycAlerts !== undefined ? kycAlerts : existing.kycAlerts,
          statusChangeAlerts: statusChangeAlerts !== undefined ? statusChangeAlerts : existing.statusChangeAlerts,
          dailyDigest: dailyDigest !== undefined ? dailyDigest : existing.dailyDigest,
          theme: theme || existing.theme,
          autoAssignTasks: autoAssignTasks !== undefined ? autoAssignTasks : existing.autoAssignTasks,
          territoryAlertRadiusKm: territoryAlertRadiusKm !== undefined ? territoryAlertRadiusKm : existing.territoryAlertRadiusKm,
          updatedAt: new Date().toISOString()
        }
      });
    } else {
      updated = await db.settings.insertOne({
        userId: uid,
        emailAlerts: emailAlerts !== undefined ? emailAlerts : true,
        kycAlerts: kycAlerts !== undefined ? kycAlerts : true,
        statusChangeAlerts: statusChangeAlerts !== undefined ? statusChangeAlerts : true,
        dailyDigest: dailyDigest !== undefined ? dailyDigest : true,
        theme: theme || 'light',
        autoAssignTasks: autoAssignTasks !== undefined ? autoAssignTasks : true,
        territoryAlertRadiusKm: territoryAlertRadiusKm !== undefined ? territoryAlertRadiusKm : 15
      });
    }

    res.json({
      success: true,
      message: 'Portal settings saved to database successfully',
      data: updated
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, message: 'Failed to save settings to database' });
  }
};

// GET /api/settings/sessions - Retrieve active security sessions for manager
const getActiveSessions = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || 'mgr_default');
    const userAgent = req.headers['user-agent'] || 'Modern Web Browser';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    let sessions = await db.securitySessions.find({ userId: uid });
    sessions = sessions.filter(s => s.status !== 'revoked');

    if (sessions.length === 0) {
      const defaultSession = await db.securitySessions.insertOne({
        userId: uid,
        device: userAgent.includes('Windows') ? 'Windows PC' : userAgent.includes('Mac') ? 'Mac OS' : userAgent.includes('Linux') ? 'Linux PC' : 'Desktop Device',
        browser: userAgent.includes('Chrome') ? 'Google Chrome' : userAgent.includes('Firefox') ? 'Mozilla Firefox' : userAgent.includes('Safari') ? 'Apple Safari' : 'Web Browser',
        ipAddress: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : '127.0.0.1',
        location: user?.state || user?.assignedState || 'India',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active',
        isCurrent: true
      });
      sessions = [defaultSession];
    } else {
      // Mark first or matching session as current
      sessions = sessions.map((s, idx) => ({
        ...s,
        isCurrent: idx === 0 || s.isCurrent === true
      }));
    }

    const settingsDoc = await db.settings.findOne({ userId: uid });

    res.json({
      success: true,
      sessions,
      inactivityTimeout: settingsDoc?.inactivityTimeout || user?.inactivityTimeout || 30
    });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve active sessions' });
  }
};

// POST /api/settings/sessions/revoke - Revoke a specific session
const revokeSession = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || 'mgr_default');
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    await db.securitySessions.findByIdAndUpdate(sessionId, {
      $set: { status: 'revoked', revokedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: 'Session revoked successfully.'
    });
  } catch (err) {
    console.error('Error revoking session:', err);
    res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
};

// POST /api/settings/sessions/revoke-others - Revoke all other sessions
const revokeAllOtherSessions = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || 'mgr_default');
    const { currentSessionId } = req.body;

    const allSessions = await db.securitySessions.find({ userId: uid });
    for (const s of allSessions) {
      const sId = String(s._id || s.id);
      if (sId !== String(currentSessionId)) {
        await db.securitySessions.findByIdAndUpdate(sId, {
          $set: { status: 'revoked', revokedAt: new Date().toISOString() }
        });
      }
    }

    res.json({
      success: true,
      message: 'All other sessions have been successfully logged out.'
    });
  } catch (err) {
    console.error('Error revoking other sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to revoke other sessions' });
  }
};

// PUT /api/settings/inactivity-timeout - Save inactivity timeout preference
const updateInactivityTimeout = async (req, res) => {
  try {
    const user = req.user;
    const uid = String(user?.id || user?._id || 'mgr_default');
    const { timeoutMinutes } = req.body;

    const timeout = parseInt(timeoutMinutes, 10) || 30;

    let existing = await db.settings.findOne({ userId: uid });
    if (existing) {
      await db.settings.findByIdAndUpdate(existing._id, {
        $set: { inactivityTimeout: timeout, updatedAt: new Date().toISOString() }
      });
    } else {
      await db.settings.insertOne({
        userId: uid,
        inactivityTimeout: timeout,
        theme: 'light',
        emailAlerts: true,
        kycAlerts: true,
        statusChangeAlerts: true
      });
    }

    // Also persist to user doc if available
    if (user?.id) {
      await db.users.findByIdAndUpdate(user.id, { $set: { inactivityTimeout: timeout } }).catch(() => {});
    }

    res.json({
      success: true,
      message: `Inactivity timeout set to ${timeout} minutes.`,
      inactivityTimeout: timeout
    });
  } catch (err) {
    console.error('Error updating inactivity timeout:', err);
    res.status(500).json({ success: false, message: 'Failed to update inactivity timeout' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  updateInactivityTimeout
};
