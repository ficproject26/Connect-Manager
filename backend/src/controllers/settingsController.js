const db = require('../config/db');

// GET /api/settings - Retrieve manager portal settings
const getSettings = async (req, res) => {
  try {
    const user = req.user;
    let settings = await db.settings.findOne({ userId: user.id });

    if (!settings) {
      settings = await db.settings.insertOne({
        userId: user.id,
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
    const { emailAlerts, kycAlerts, statusChangeAlerts, dailyDigest, theme, autoAssignTasks, territoryAlertRadiusKm } = req.body;

    let existing = await db.settings.findOne({ userId: user.id });

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
        userId: user.id,
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

module.exports = {
  getSettings,
  updateSettings
};
