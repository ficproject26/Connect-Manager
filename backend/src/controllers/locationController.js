const db = require('../config/db');

// GET /api/states - Read-only, filtered by manager's scope, strictly Active
const getStates = async (req, res) => {
  try {
    const user = req.user || {};
    let states = await db.states.find({ status: 'Active' });

    if (user.stateId) {
      states = states.filter(s => String(s._id || s.id) === String(user.stateId));
    } else if (user.state && user.state !== 'All India') {
      states = states.filter(s => s.name?.toLowerCase() === user.state.toLowerCase());
    }

    res.json({ success: true, data: states, states });
  } catch (err) {
    console.error('Get states error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve states' });
  }
};

// GET /api/districts - Read-only, strictly cascading under selected State
const getDistricts = async (req, res) => {
  try {
    const user = req.user || {};
    const { stateId, state } = req.query;

    let targetStateId = stateId || user.stateId;
    if (!targetStateId && (state || user.state)) {
      const stateName = state || user.state;
      const stateDoc = await db.states.findOne({ name: new RegExp('^' + stateName.trim() + '$', 'i'), status: 'Active' });
      if (stateDoc) {
        targetStateId = stateDoc._id || stateDoc.id;
      }
    }

    let query = { status: 'Active' };
    if (targetStateId) {
      query.stateId = targetStateId;
    }

    let districts = await db.districts.find(query);

    // If manager has specific district assignment, restrict to only that district
    if (user.districtId) {
      districts = districts.filter(d => String(d._id || d.id) === String(user.districtId));
    } else if (user.district) {
      districts = districts.filter(d => d.name?.toLowerCase() === user.district.toLowerCase());
    }

    res.json({ success: true, data: districts, districts });
  } catch (err) {
    console.error('Get districts error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve districts' });
  }
};

// GET /api/divisions - Read-only, strictly cascading under selected District
const getDivisions = async (req, res) => {
  try {
    const user = req.user || {};
    const { districtId, district, stateId } = req.query;

    let targetDistrictId = districtId || user.districtId;
    if (!targetDistrictId && (district || user.district)) {
      const distName = district || user.district;
      const distDoc = await db.districts.findOne({ name: new RegExp('^' + distName.trim() + '$', 'i'), status: 'Active' });
      if (distDoc) {
        targetDistrictId = distDoc._id || distDoc.id;
      }
    }

    let query = { status: 'Active' };
    if (targetDistrictId) {
      query.districtId = targetDistrictId;
    } else if (stateId || user.stateId) {
      query.stateId = stateId || user.stateId;
    }

    let divisions = await db.divisions.find(query);

    if (user.divisionId) {
      divisions = divisions.filter(d => String(d._id || d.id) === String(user.divisionId));
    } else if (user.division) {
      divisions = divisions.filter(d => d.name?.toLowerCase() === user.division.toLowerCase());
    }

    res.json({ success: true, data: divisions, divisions });
  } catch (err) {
    console.error('Get divisions error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve divisions' });
  }
};

// GET /api/pincodes - Read-only, strictly cascading under selected Division
const getPincodes = async (req, res) => {
  try {
    const user = req.user || {};
    const { divisionId, division, districtId, district, stateId } = req.query;

    let targetDivisionId = divisionId || user.divisionId;
    if (!targetDivisionId && (division || user.division)) {
      const divName = division || user.division;
      const divDoc = await db.divisions.findOne({ name: new RegExp('^' + divName.trim() + '$', 'i'), status: 'Active' });
      if (divDoc) {
        targetDivisionId = divDoc._id || divDoc.id;
      }
    }

    let query = { status: 'Active' };
    if (targetDivisionId) {
      query.divisionId = targetDivisionId;
    } else if (districtId || user.districtId) {
      query.districtId = districtId || user.districtId;
    } else if (stateId || user.stateId) {
      query.stateId = stateId || user.stateId;
    }

    let pincodes = await db.pincodes.find(query);

    if (user.pincodeId) {
      pincodes = pincodes.filter(p => String(p._id || p.id) === String(user.pincodeId));
    } else if (user.pincode) {
      pincodes = pincodes.filter(p => String(p.code || p.pincode).trim() === String(user.pincode).trim());
    }

    res.json({ success: true, data: pincodes, pincodes });
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
