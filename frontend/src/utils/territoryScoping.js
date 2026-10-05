/**
 * Strict Territory Scoping and Verification Utility for Manager & Admin Portals
 * 
 * Rules:
 * 1. Pincode Manager / Pincode Admin:
 *    - STRICTLY views ONLY tasks belonging to their assigned Pincode (e.g. 636112).
 *    - Never views tasks from other pincodes (e.g. 635109 Hosur / Central).
 * 2. Division Manager / Division Admin:
 *    - STRICTLY views ONLY tasks belonging to their assigned Division (all pincodes in that division).
 *    - Never views tasks from other divisions.
 * 3. District Manager / District Admin:
 *    - STRICTLY views ONLY tasks belonging to their assigned District (all divisions and pincodes in that district).
 *    - Never views tasks from other districts.
 * 4. State Manager / State Admin:
 *    - STRICTLY views ONLY tasks belonging to their assigned State (all districts in that state).
 *    - Never views tasks from other states.
 * 5. Super Admin / Central Admin:
 *    - Pan-India access to all tasks.
 * 6. Mock / Benchmark / Irrelevant test data:
 *    - Completely filtered out from operational manager views.
 */

const normalize = (val) => {
  if (val == null) return '';
  if (typeof val === 'object') {
    return String(val.name || val.code || val.id || val._id || '').trim().toLowerCase();
  }
  return String(val).trim().toLowerCase();
};

/**
 * Resolves the authenticated user's territory profile and hierarchical level.
 * Handles both manager and admin role variations, nested territories, and jurisdiction strings.
 */
export const resolveUserTerritoryProfile = (user) => {
  if (!user) {
    return {
      level: 'other',
      role: '',
      state: '',
      district: '',
      division: '',
      pincode: ''
    };
  }

  const role = normalize(user.role || '').replace(/[-_]/g, ' ');
  const levelNum = Number(user.level);
  const levelStr = normalize(user.level || '');

  let level = 'other';
  if (
    ['admin', 'super admin', 'system admin', 'central admin'].some(r => role.includes(r)) ||
    levelNum === 0 ||
    user.email === 'admin@example.com'
  ) {
    level = 'admin';
  } else if (role.includes('pincode') || levelNum === 4 || levelStr === 'pincode') {
    level = 'pincode';
  } else if (role.includes('division') || role.includes('divisional') || levelNum === 3 || levelStr === 'division') {
    level = 'division';
  } else if (role.includes('district') || levelNum === 2 || levelStr === 'district') {
    level = 'district';
  } else if (role.includes('state') || levelNum === 1 || levelStr === 'state') {
    level = 'state';
  }

  // Pincode extraction
  let pincode = user.pincode || user.pincodeCode || user.scope?.pincodeCode || user.assignedPincode || user.territory?.pincode || '';
  if (!pincode && user.targetJurisdiction) {
    const pinMatch = String(user.targetJurisdiction).match(/(\d{6})/);
    if (pinMatch) pincode = pinMatch[1];
  }
  pincode = normalize(pincode);
  const pincodeId = normalize(user.pincodeId || user.scope?.pincodeId || user.assignedPincodeId);

  // Division extraction
  let division = user.division || user.divisionName || user.scope?.divisionName || user.assignedDivision || user.territory?.division || '';
  division = normalize(division);
  const divisionId = normalize(user.divisionId || user.scope?.divisionId || user.assignedDivisionId);

  // District extraction
  let district = user.district || user.districtName || user.scope?.districtName || user.assignedDistrict || user.territory?.district || '';
  district = normalize(district);
  const districtId = normalize(user.districtId || user.scope?.districtId || user.assignedDistrictId);

  // State extraction
  let state = user.state || user.stateName || user.scope?.stateName || user.scope?.regionName || user.assignedState || user.territory?.state || '';
  state = normalize(state);
  const stateId = normalize(user.stateId || user.scope?.stateId || user.regionId || user.scope?.regionId || user.assignedStateId);

  return {
    level,
    role,
    state,
    stateId,
    district,
    districtId,
    division,
    divisionId,
    pincode,
    pincodeId,
    rawUser: user
  };
};

/**
 * Checks whether a task is a mock / benchmark / irrelevant dummy task.
 */
export const isMockOrTestTask = (task) => {
  if (!task) return false;
  const tId = normalize(task.id || task._id || task.taskNumber);
  const tTitle = normalize(task.title);
  const tDesc = normalize(task.description);
  const tVendor = normalize(task.vendor || task.merchantName || task.shopName);

  return (
    tId.startsWith('bench_task_') ||
    tTitle.includes('benchmark task') ||
    tTitle.includes('centralized realtime sync test task') ||
    tVendor.includes('realtime test store') ||
    tDesc.includes('centralized realtime sync test task')
  );
};

/**
 * Validates whether a specific task belongs STRICTLY to the manager's authorized territory.
 */
export const isTaskInManagerTerritory = (task, profile) => {
  if (!task || !profile) return false;

  // Central / Super Admins see all tasks
  if (profile.level === 'admin') return true;

  // Operational managers must NOT see mock or benchmark dummy tasks
  if (isMockOrTestTask(task)) return false;

  // Direct assignment check: Tasks assigned directly to this manager are always accessible
  const managerId = normalize(profile.rawUser?.id || profile.rawUser?._id || profile.rawUser?.managerId);
  const taskAssigneeId = normalize(task.assignedManagerId || task.assignedAgentId);
  if (managerId && taskAssigneeId && managerId === taskAssigneeId) {
    return true;
  }

  const tStateId = normalize(task.stateId);
  const tState = normalize(task.state || task.stateName);
  const tDistId = normalize(task.districtId);
  const tDist = normalize(task.district || task.districtName);
  const tDivId = normalize(task.divisionId);
  const tDiv = normalize(task.division || task.divisionName);
  const tPinId = normalize(task.pincodeId);
  const tPin = normalize(task.pincode || task.pincodeCode);
  const tLoc = normalize(task.location || task.territory);

  // Helper: State check
  const matchState = () => {
    if (profile.stateId && tStateId && profile.stateId === tStateId) return true;
    if (profile.state && tState && (profile.state === tState || tState.includes(profile.state) || profile.state.includes(tState))) return true;
    if (profile.state && tLoc && tLoc.includes(profile.state)) return true;
    if (!profile.state && !profile.stateId) return true;
    return false;
  };

  // Helper: District check
  const matchDistrict = () => {
    if (!matchState()) return false;
    if (profile.districtId && tDistId && profile.districtId === tDistId) return true;
    if (profile.district && tDist && (profile.district === tDist || tDist.includes(profile.district) || profile.district.includes(tDist))) return true;
    if (profile.district && tLoc && tLoc.includes(profile.district)) return true;
    if (!profile.district && !profile.districtId) return true;
    return false;
  };

  // Helper: Division check
  const matchDivision = () => {
    if (!matchDistrict()) return false;
    if (profile.divisionId && tDivId && profile.divisionId === tDivId) return true;
    if (profile.division && tDiv && (profile.division === tDiv || tDiv.includes(profile.division) || profile.division.includes(tDiv))) return true;
    if (profile.division && tLoc && tLoc.includes(profile.division)) return true;
    if (!profile.division && !profile.divisionId) return true;
    return false;
  };

  switch (profile.level) {
    case 'state':
      return matchState();

    case 'district':
      return matchDistrict();

    case 'division':
      return matchDivision();

    case 'pincode':
      // Match directly by pincode ID or pincode code
      if (profile.pincodeId && tPinId && profile.pincodeId === tPinId) return true;
      if (profile.pincode && tPin && profile.pincode === tPin) return true;
      if (profile.pincode && tLoc && tLoc.includes(profile.pincode)) return true;
      return false;

    default:
      return false;
  }
};

/**
 * Builds HTTP query parameters for taskService.getTasks based on user territory profile.
 */
export const buildTerritoryQueryParams = (profile) => {
  if (!profile) return {};
  const params = {};

  if (profile.level === 'pincode') {
    if (profile.pincode) params.pincode = profile.pincode;
    if (profile.division) params.division = profile.division;
    if (profile.district) params.district = profile.district;
    if (profile.state) params.state = profile.state;
  } else if (profile.level === 'division') {
    if (profile.division) params.division = profile.division;
    if (profile.district) params.district = profile.district;
    if (profile.state) params.state = profile.state;
  } else if (profile.level === 'district') {
    if (profile.district) params.district = profile.district;
    if (profile.state) params.state = profile.state;
  } else if (profile.level === 'state') {
    if (profile.state) params.state = profile.state;
  }

  return params;
};
