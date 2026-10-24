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
    // Filter active sessions only
    sessions = sessions.filter(s => s.status !== 'revoked' && s.isActive !== false);

    if (sessions.length === 0) {
      const currSessionId = user?.sessionId || (crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`);
      const dev = userAgent.includes('Windows') ? 'Windows PC' : userAgent.includes('Mac') ? 'Mac OS' : userAgent.includes('Linux') ? 'Linux PC' : 'Desktop Device';
      const br = userAgent.includes('Chrome') ? 'Google Chrome' : userAgent.includes('Firefox') ? 'Mozilla Firefox' : userAgent.includes('Safari') ? 'Apple Safari' : 'Web Browser';
      const defaultSession = await db.securitySessions.insertOne({
        sessionId: currSessionId,
        userId: user?._id || uid,
        device: dev,
        browser: br,
        deviceInfo: {
          deviceName: `${dev} (${br})`,
          browser: br,
          os: dev,
          deviceType: /mobile|phone/i.test(dev) ? 'Mobile' : 'Desktop'
        },
        ipAddress: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : '127.0.0.1',
        location: user?.state || user?.assignedState || 'Tamil Nadu',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active',
        isActive: true
      });
      sessions = [defaultSession];
    }

    // Format and determine isCurrent accurately
    const formattedSessions = sessions.map((s, idx) => {
      const sId = String(s.sessionId || s._id || s.id);
      const isCurrent = user?.sessionId
        ? (sId === String(user.sessionId))
        : (idx === 0);

      const deviceName = s.device || s.deviceInfo?.deviceName || s.deviceInfo?.os || 'Desktop Browser';
      const browserName = s.browser || s.deviceInfo?.browser || 'Web Browser';
      let locStr = 'Assigned Territory';
      if (typeof s.location === 'string' && s.location) {
        locStr = s.location;
      } else if (s.location && typeof s.location === 'object') {
        locStr = [s.location.city, s.location.country].filter(Boolean).join(', ') || 'India';
      } else if (user?.state || user?.assignedState) {
        locStr = user?.state || user?.assignedState;
      }

      return {
        _id: s._id || sId,
        id: sId,
        sessionId: sId,
        userId: String(s.userId || uid),
        device: deviceName,
        browser: browserName,
        ipAddress: s.ipAddress || (typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : '127.0.0.1'),
        location: locStr,
        lastActive: s.lastActive || s.updatedAt || s.createdAt || new Date().toISOString(),
        createdAt: s.createdAt || new Date().toISOString(),
        status: s.status || 'active',
        isActive: s.isActive !== false,
        isCurrent
      };
    });

    if (!formattedSessions.some(s => s.isCurrent) && formattedSessions.length > 0) {
      formattedSessions[0].isCurrent = true;
    }

    const settingsDoc = await db.settings.findOne({ userId: uid });

    res.json({
      success: true,
      sessions: formattedSessions,
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
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    await db.securitySessions.updateMany(
      { $or: [{ sessionId: sessionId }, { _id: sessionId }, { id: sessionId }] },
      { $set: { status: 'revoked', isActive: false, revokedAt: new Date().toISOString() } }
    );

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
    const currentSessionId = req.body.currentSessionId || user?.sessionId;

    const allSessions = await db.securitySessions.find({ userId: uid });
    for (const s of allSessions) {
      const sId = String(s.sessionId || s._id || s.id);
      if (sId !== String(currentSessionId)) {
        await db.securitySessions.findByIdAndUpdate(s._id || s.id, {
          $set: { status: 'revoked', isActive: false, revokedAt: new Date().toISOString() }
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
