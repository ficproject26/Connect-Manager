const db = require('../config/db');

// GET /api/states - Read-only, filtered by manager's scope
const getStates = async (req, res) => {
  try {
    const user = req.user;
    let states = [];

    if (user.stateId) {
      const state = await db.states.findById(user.stateId);
      if (state) states = [state];
    } else {
      states = await db.states.find();
    }

    res.json({ success: true, data: states });
  } catch (err) {
    console.error('Get states error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve states' });
  }
};

// GET /api/districts - Read-only, scoped to manager's state / district
const getDistricts = async (req, res) => {
  try {
    const user = req.user;
    const { stateId } = req.query;

    const queryStateId = stateId || user.stateId;

    let districts = await db.districts.find({ stateId: queryStateId });

    // If manager has specific district assignment, restrict to only that district
    if (user.districtId) {
      districts = districts.filter(d => d._id === user.districtId);
    }

    res.json({ success: true, data: districts });
  } catch (err) {
    console.error('Get districts error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve districts' });
  }
};

// GET /api/divisions - Read-only, scoped to manager's district / division
const getDivisions = async (req, res) => {
  try {
    const user = req.user;
    const { districtId } = req.query;

    const queryDistrictId = districtId || user.districtId;

    let divisions = [];
    if (queryDistrictId) {
      divisions = await db.divisions.find({ districtId: queryDistrictId });
    } else if (user.stateId) {
      divisions = await db.divisions.find({ stateId: user.stateId });
    } else {
      divisions = await db.divisions.find();
    }

    if (user.divisionId) {
      divisions = divisions.filter(d => d._id === user.divisionId);
    }

    res.json({ success: true, data: divisions });
  } catch (err) {
    console.error('Get divisions error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve divisions' });
  }
};

// GET /api/pincodes - Read-only, scoped to manager's division / pincode
const getPincodes = async (req, res) => {
  try {
    const user = req.user;
    const { divisionId, districtId } = req.query;

    const queryDivId = divisionId || user.divisionId;

    let pincodes = [];
    if (queryDivId) {
      pincodes = await db.pincodes.find({ divisionId: queryDivId });
    } else if (districtId || user.districtId) {
      pincodes = await db.pincodes.find({ districtId: districtId || user.districtId });
    } else if (user.stateId) {
      pincodes = await db.pincodes.find({ stateId: user.stateId });
    } else {
      pincodes = await db.pincodes.find();
    }

    if (user.pincodeId) {
      pincodes = pincodes.filter(p => p._id === user.pincodeId);
    }

    res.json({ success: true, data: pincodes });
  } catch (err) {
    console.error('Get pincodes error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve pincodes' });
  }
};

module.exports = {
  getStates,
  getDistricts,
  getDivisions,
  getPincodes
};
