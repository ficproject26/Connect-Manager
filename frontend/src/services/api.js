const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) || '';
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const isRemoteHttp = rawApiUrl && rawApiUrl.startsWith('http://');

// If frontend is loaded via HTTPS and backend URL is an insecure HTTP address,
// we MUST use relative '/api' so Vercel rewrites proxy the request securely without Mixed Content errors.
export const API_BASE = (isHttps && isRemoteHttp)
  ? '/api'
  : (rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`) : '/api');

const getAuthToken = () => {
  return (
    (typeof localStorage !== 'undefined' && (
      localStorage.getItem('agent_mgr_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('auth_token')
    )) ||
    (typeof sessionStorage !== 'undefined' && (
      sessionStorage.getItem('agent_mgr_token') ||
      sessionStorage.getItem('token')
    )) ||
    ''
  );
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('agent_mgr_token');
      }
    }
    const errorMsg = data.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}


export const authService = {
  async login(identifier, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    return handleResponse(res);
  },

  async sendOtp(mobile) {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile })
    });
    return handleResponse(res);
  },

  async verifyOtp(mobile, otp) {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, otp })
    });
    return handleResponse(res);
  },

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async resetPassword(token, newPassword) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    return handleResponse(res);
  },

  async register(userData) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse(res);
  },

  async checkCapacity(params) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/auth/check-capacity?${query.toString()}`);
    return handleResponse(res);
  },

  async getRegistrationLocations() {
    const res = await fetch(`${API_BASE}/auth/locations`);
    return handleResponse(res);
  },

  async simulateApproval(userId) {
    const res = await fetch(`${API_BASE}/auth/simulate-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return handleResponse(res);
  },

  async simulateKyc(userId) {
    const res = await fetch(`${API_BASE}/auth/simulate-kyc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return handleResponse(res);
  },

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${API_BASE}/auth/upload-avatar`, {
      method: 'POST',
      body: formData
    });
    return handleResponse(res);
  },

  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);
    const res = await fetch(`${API_BASE}/auth/upload-document`, {
      method: 'POST',
      body: formData
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async refreshToken() {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async changePassword(currentPassword, newPassword) {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return handleResponse(res);
  }
};

// Helper function to decode JWT payload safely in browser
function parseTokenUser() {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('agent_mgr_token') : null;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Scopes full directory managers according to user hierarchy and territory
export function scopeManagersForUser(allRawManagers, currentUser) {
  if (!allRawManagers || !Array.isArray(allRawManagers)) {
    return { success: true, count: 0, all: [], peers: [], subordinates: [], data: [] };
  }

  const effectiveUser = currentUser || parseTokenUser() || {};
  const currentId = String(effectiveUser.id || effectiveUser._id || '');
  const userRole = String(effectiveUser.role || '').toLowerCase();

  const getLevel = (role) => {
    const r = String(role || '').toLowerCase();
    if (r.includes('state')) return 1;
    if (r.includes('district')) return 2;
    if (r.includes('division') || r.includes('divisional')) return 3;
    if (r.includes('pincode')) return 4;
    return 99;
  };

  const userLevel = Number(effectiveUser.level) || getLevel(userRole);
  const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].includes(userRole) ||
    effectiveUser.email === 'admin@example.com' ||
    currentId === 'user_admin';

  const norm = (s) => (s ? String(s).trim().toLowerCase() : '');

  const userStateId = norm(effectiveUser.stateId || effectiveUser.assignedStateId || effectiveUser.regionId || effectiveUser.scope?.stateId);
  const userStateName = norm(effectiveUser.state || effectiveUser.stateName || effectiveUser.assignedState || effectiveUser.scope?.stateName);

  const userDistrictId = norm(effectiveUser.districtId || effectiveUser.assignedDistrictId || effectiveUser.scope?.districtId);
  const userDistrictName = norm(effectiveUser.district || effectiveUser.districtName || effectiveUser.assignedDistrict || effectiveUser.scope?.districtName);

  const userDivisionId = norm(effectiveUser.divisionId || effectiveUser.assignedDivisionId || effectiveUser.scope?.divisionId);
  const userDivisionName = norm(effectiveUser.division || effectiveUser.divisionName || effectiveUser.assignedDivision || effectiveUser.scope?.divisionName);

  const userPincodeId = norm(effectiveUser.pincodeId || effectiveUser.assignedPincodeId || effectiveUser.scope?.pincodeId);
  const userPincode = norm(effectiveUser.pincode || effectiveUser.pincodeCode || effectiveUser.scope?.pincodeCode);

  const matchState = (m) => {
    if (isGlobalAdmin) return true;
    const mStateId = norm(m.stateId || m.regionId || m.assignedStateId);
    const mStateName = norm(m.stateName || m.state || m.assignedState);
    if (userStateId && mStateId && userStateId === mStateId) return true;
    if (userStateName && mStateName && userStateName === mStateName) return true;
    return !userStateId && !userStateName;
  };

  const matchDistrict = (m) => {
    if (!matchState(m)) return false;
    if (userLevel === 1 || isGlobalAdmin) return true;
    const mDistrictId = norm(m.districtId || m.assignedDistrictId);
    const mDistrictName = norm(m.districtName || m.district || m.assignedDistrict);
    if (userDistrictId && mDistrictId && userDistrictId === mDistrictId) return true;
    if (userDistrictName && mDistrictName && userDistrictName === mDistrictName) return true;
    return !userDistrictId && !userDistrictName;
  };

  const matchDivision = (m) => {
    if (!matchDistrict(m)) return false;
    if (userLevel <= 2 || isGlobalAdmin) return true;
    const mDivisionId = norm(m.divisionId || m.assignedDivisionId);
    const mDivisionName = norm(m.divisionName || m.division || m.assignedDivision);
    if (userDivisionId && mDivisionId && userDivisionId === mDivisionId) return true;
    if (userDivisionName && mDivisionName && userDivisionName === mDivisionName) return true;
    return !userDivisionId && !userDivisionName;
  };

  const matchPincode = (m) => {
    if (isGlobalAdmin) return true;
    if (!matchState(m)) return false;
    const mPincodeId = norm(m.pincodeId || m.assignedPincodeId);
    const mPin = norm(m.pincodeCode || m.pincode || m.assignedPincode);
    if (userPincode && mPin && userPincode === mPin) return true;
    if (userPincodeId && mPincodeId && userPincodeId === mPincodeId) return true;
    return false;
  };

  const formatRoleTitle = (role) => {
    const r = norm(role);
    if (r.includes('state')) return 'State Agent Manager (Level 1)';
    if (r.includes('district')) return 'District Agent Manager (Level 2)';
    if (r.includes('division') || r.includes('divisional')) return 'Division Agent Manager (Level 3)';
    if (r.includes('pincode')) return 'Pincode Agent Manager (Level 4)';
    return role || 'Manager';
  };

  const seen = new Set();
  const supervisors = [];
  const peers = [];
  const subordinates = [];

  for (const raw of allRawManagers) {
    if (!raw) continue;
    const mId = String(raw.id || raw._id || '');
    if (!mId || mId === currentId || seen.has(mId)) continue;
    if (raw.isSelf) continue;
    seen.add(mId);

    const mLevel = getLevel(raw.role);

    let normLevel = raw.level;
    if (!normLevel || typeof normLevel === 'number') {
      if (mLevel === 1) normLevel = 'state';
      else if (mLevel === 2) normLevel = 'district';
      else if (mLevel === 3) normLevel = 'division';
      else if (mLevel === 4) normLevel = 'pincode';
    }

    const enhancedManager = {
      ...raw,
      id: mId,
      name: raw.name || 'Manager',
      email: raw.email || '',
      mobile: raw.mobile || raw.phone || '',
      role: raw.role || 'manager',
      roleTitle: formatRoleTitle(raw.role),
      level: normLevel,
      status: String(raw.status || 'active').toLowerCase(),
      isSelf: false
    };

    if (mLevel < userLevel) {
      // Supervisor: higher rank in user's territorial branch
      let isSupervisorInScope = false;
      if (userLevel === 4) {
        if (mLevel === 3) isSupervisorInScope = matchDivision(raw) || matchDistrict(raw);
        if (mLevel === 2) isSupervisorInScope = matchDistrict(raw);
        if (mLevel === 1) isSupervisorInScope = matchState(raw);
      } else if (userLevel === 3) {
        if (mLevel === 2) isSupervisorInScope = matchDistrict(raw);
        if (mLevel === 1) isSupervisorInScope = matchState(raw);
      } else if (userLevel === 2) {
        if (mLevel === 1) isSupervisorInScope = matchState(raw);
      }

      if (isSupervisorInScope) {
        enhancedManager.relation = 'supervisor';
        enhancedManager.relationLabel = 'Reporting Authority (Supervisor)';
        supervisors.push(enhancedManager);
      }
    } else if (mLevel === userLevel) {
      let isPeerInScope = false;
      if (userLevel === 1) isPeerInScope = true; // State managers nationwide are peers
      else if (userLevel === 2) isPeerInScope = matchState(raw);
      else if (userLevel === 3) isPeerInScope = matchDistrict(raw) || matchState(raw);
      else if (userLevel === 4) isPeerInScope = matchDivision(raw) || matchDistrict(raw) || matchState(raw);
      else if (isGlobalAdmin) isPeerInScope = true;

      if (isPeerInScope) {
        enhancedManager.relation = 'peer';
        enhancedManager.relationLabel = 'Equal Level (Peer)';
        peers.push(enhancedManager);
      }
    } else if (mLevel > userLevel) {
      let isSubInScope = false;
      if (userLevel === 1) isSubInScope = [2, 3, 4].includes(mLevel) && matchState(raw);
      else if (userLevel === 2) isSubInScope = [3, 4].includes(mLevel) && matchDistrict(raw);
      else if (userLevel === 3) isSubInScope = mLevel === 4 && matchDivision(raw);
      else if (isGlobalAdmin) isSubInScope = true;

      if (isSubInScope) {
        enhancedManager.relation = 'subordinate';
        enhancedManager.relationLabel = 'Under Your Scope (Subordinate)';
        subordinates.push(enhancedManager);
      }
    }
  }

  const all = [...supervisors, ...peers, ...subordinates];
  return {
    success: true,
    count: all.length,
    data: subordinates,
    subordinates,
    peers,
    supervisors,
    reporting: supervisors,
    all,
    stats: {
      total: all.length,
      supervisorsCount: supervisors.length,
      peersCount: peers.length,
      subordinatesCount: subordinates.length,
      currentUserRole: userRole
    }
  };
}

// Scopes agents strictly according to user hierarchy and territory
export function scopeAgentsForUser(rawAgents, currentUser) {
  if (!Array.isArray(rawAgents) || rawAgents.length === 0) return [];
  const effectiveUser = currentUser || parseTokenUser() || {};
  const role = String(effectiveUser.role || '').toLowerCase();
  const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].some(r => role.includes(r)) || effectiveUser.email === 'admin@example.com';
  if (isGlobalAdmin) return rawAgents;

  const mLevel = Number(effectiveUser.level) || 
    (role.includes('pincode') ? 4 : role.includes('division') ? 3 : role.includes('district') ? 2 : 1);

  const norm = (s) => String(s || '').trim().toLowerCase();

  const mStateId = norm(effectiveUser.stateId || effectiveUser.scope?.stateId || effectiveUser.regionId || effectiveUser.scope?.regionId);
  const mState = norm(effectiveUser.state || effectiveUser.stateName || effectiveUser.scope?.stateName);

  const mDistrictId = norm(effectiveUser.districtId || effectiveUser.scope?.districtId);
  const mDistrict = norm(effectiveUser.district || effectiveUser.districtName || effectiveUser.scope?.districtName);

  const mDivisionId = norm(effectiveUser.divisionId || effectiveUser.scope?.divisionId);
  const mDivision = norm(effectiveUser.division || effectiveUser.divisionName || effectiveUser.scope?.divisionName);

  const mPincodeId = norm(effectiveUser.pincodeId || effectiveUser.scope?.pincodeId);
  const mPincode = norm(effectiveUser.pincode || effectiveUser.pincodeCode || effectiveUser.scope?.pincodeCode);

  return rawAgents.filter(agent => {
    if (!agent) return false;
    const aStateId = norm(agent.stateId || agent.territory?.stateId);
    const aState = norm(agent.state || agent.stateName || agent.territory?.state);

    const aDistrictId = norm(agent.districtId || agent.territory?.districtId);
    const aDistrict = norm(agent.district || agent.districtName || agent.territory?.district);

    const aDivisionId = norm(agent.divisionId || agent.territory?.divisionId);
    const aDivision = norm(agent.division || agent.divisionName || agent.territory?.division);

    const aPincodeId = norm(agent.pincodeId || agent.territory?.pincodeId);
    const aPincode = norm(agent.pincode || agent.pincodeCode || agent.territory?.pincode);

    const matchState = () => {
      if (mStateId && aStateId && mStateId === aStateId) return true;
      if (mState && aState && mState === aState) return true;
      if (!mStateId && !mState) return true;
      return false;
    };

    const matchDistrict = () => {
      if (!matchState()) return false;
      if (mDistrictId && aDistrictId && mDistrictId === aDistrictId) return true;
      if (mDistrict && aDistrict && mDistrict === aDistrict) return true;
      if (!mDistrictId && !mDistrict) return true;
      return false;
    };

    const matchDivision = () => {
      if (!matchDistrict()) return false;
      if (mDivisionId && aDivisionId && mDivisionId === aDivisionId) return true;
      if (mDivision && aDivision && mDivision === aDivision) return true;
      if (!mDivisionId && !mDivision) return true;
      return false;
    };

    const matchPincode = () => {
      if (!matchState()) return false;
      if (mPincodeId && aPincodeId && mPincodeId === aPincodeId) return true;
      if (mPincode && aPincode && mPincode === aPincode) return true;
      return false;
    };

    const aRole = norm(agent.role);
    const getAgentLevel = (r) => {
      if (r.includes('state')) return 1;
      if (r.includes('district')) return 2;
      if (r.includes('division') || r.includes('divisional')) return 3;
      if (r.includes('pincode') || r.includes('field') || r.includes('pin')) return 4;
      return 4;
    };
    const aLevel = Number(agent.level) || getAgentLevel(aRole);

    if (mLevel === 1) {
      // State Manager: State, District, Division, and Pincode agents in assigned state
      return matchState();
    } else if (mLevel === 2) {
      // District Manager: District, Division, and Pincode agents in assigned district (no state agents)
      if (aLevel === 1) return false;
      return matchDistrict();
    } else if (mLevel === 3) {
      // Division Manager: Division and Pincode agents in assigned division (no state or district agents)
      if (aLevel === 1 || aLevel === 2) return false;
      return matchDivision();
    } else if (mLevel === 4) {
      // Pincode Manager: ONLY Pincode agents in the exact assigned pincode
      if (aLevel !== 4) return false;
      return matchPincode();
    }
    return false;
  }).map(agent => {
    const pCode = agent.pincode || agent.pincodeCode || agent.territory?.pincode || '';
    const dName = agent.district || agent.districtName || agent.territory?.district || '';
    const divName = agent.division || agent.divisionName || agent.territory?.division || '';
    const sName = agent.state || agent.stateName || agent.territory?.state || '';
    return {
      ...agent,
      pincode: pCode,
      pincodeCode: pCode,
      district: dName,
      division: divName,
      state: sName
    };
  });
}

export const managerService = {
  async getLowerLevelManagers(params = {}, currentUser = null) {
    return this.getManagerDirectory(params, currentUser);
  },
  async getManagerDirectory(params = {}, currentUser = null) {
    const query = new URLSearchParams(params);
    let data = null;
    try {
      const res = await fetch(`${API_BASE}/managers?${query.toString()}`, {
        headers: getAuthHeaders()
      });
      data = await handleResponse(res);
    } catch (e) {
      console.warn('Standard manager directory fetch error:', e);
    }

    if (data && data.success) {
      const supervisors = Array.isArray(data.supervisors) ? data.supervisors : (Array.isArray(data.reporting) ? data.reporting : []);
      const peers = Array.isArray(data.peers) ? data.peers : [];
      const subordinates = Array.isArray(data.subordinates) ? data.subordinates : (Array.isArray(data.data) ? data.data : []);
      let all = Array.isArray(data.all) && data.all.length > 0 ? data.all : [...supervisors, ...peers, ...subordinates];

      // If remote backend returned 0 managers (e.g. older remote API on 3.110.88.42), fallback scope using full list
      if (all.length === 0) {
        try {
          const fallbackRes = await fetch(`${API_BASE}/managers`, {
            headers: getAuthHeaders()
          });
          const fallbackData = await handleResponse(fallbackRes);
          if (fallbackData && fallbackData.success && Array.isArray(fallbackData.all) && fallbackData.all.length > 0) {
            return scopeManagersForUser(fallbackData.all, currentUser);
          }
        } catch (err) {
          console.warn('Directory scoping fallback error:', err);
        }
      }

      return {
        ...data,
        all,
        data: subordinates,
        subordinates,
        peers,
        supervisors,
        reporting: supervisors,
        count: all.length,
        stats: data.stats || {
          total: all.length,
          supervisorsCount: supervisors.length,
          peersCount: peers.length,
          subordinatesCount: subordinates.length
        }
      };
    }

    // Fallback only if primary query completely failed
    try {
      const fallbackRes = await fetch(`${API_BASE}/managers`, {
        headers: getAuthHeaders()
      });
      const fallbackData = await handleResponse(fallbackRes);
      if (fallbackData && fallbackData.success && Array.isArray(fallbackData.all)) {
        return scopeManagersForUser(fallbackData.all, currentUser);
      }
    } catch (err) {
      console.warn('Directory scoping fetch error:', err);
    }

    return { 
      success: true, 
      count: 0, 
      all: [], 
      peers: [], 
      subordinates: [], 
      supervisors: [], 
      reporting: [], 
      data: [], 
      stats: { total: 0, supervisorsCount: 0, peersCount: 0, subordinatesCount: 0 } 
    };
  }
};

export const vendorService = {
  async getVendors(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    });

    const res = await fetch(`${API_BASE}/vendors?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getVendorById(id, unmask = false) {
    const res = await fetch(`${API_BASE}/vendors/${id}?unmask=${unmask}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async createVendor(data) {
    const res = await fetch(`${API_BASE}/vendors`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateStatus(id, status, notes = '') {
    const res = await fetch(`${API_BASE}/vendors/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, notes })
    });
    return handleResponse(res);
  }
};

export const locationService = {
  async getStates() {
    const res = await fetch(`${API_BASE}/states`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async getDistricts(stateId) {
    const query = stateId ? `?stateId=${stateId}` : '';
    const res = await fetch(`${API_BASE}/districts${query}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async getDivisions(districtId) {
    const query = districtId ? `?districtId=${districtId}` : '';
    const res = await fetch(`${API_BASE}/divisions${query}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async getPincodes(divisionId) {
    const query = divisionId ? `?divisionId=${divisionId}` : '';
    const res = await fetch(`${API_BASE}/pincodes${query}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  }
};

export const reportService = {
  async getDashboardStats() {
    const res = await fetch(`${API_BASE}/reports/dashboard`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async getLeaderboardData(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/reports/leaderboard?${query.toString()}`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async getVendorReportData() {
    const res = await fetch(`${API_BASE}/reports/vendors`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async submitReport(data) {
    const res = await fetch(`${API_BASE}/reports/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getSubmittedReports(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v);
      }
    });
    const res = await fetch(`${API_BASE}/reports/submitted?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    if (res.status === 404) {
      return { success: true, data: [], hierarchy: { districts: [], divisions: [], pincodes: [] } };
    }
    return handleResponse(res);
  },

  async getSubmittedReportById(id) {
    const res = await fetch(`${API_BASE}/reports/submitted/${id}`, {
      headers: getAuthHeaders()
    });
    if (res.status === 404) {
      return { success: false, message: 'Report not found' };
    }
    return handleResponse(res);
  }
};

export const auditService = {
  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/audit-logs`, { headers: getAuthHeaders() });
    if (res.status === 404) {
      return { success: true, logs: [], data: [] };
    }
    return handleResponse(res);
  }
};

export const uploadService = {
  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);

    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/uploads/document`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        return await res.json();
      }

      // If /uploads/document failed with 401/403/404, fallback to /auth/upload-document
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const fallbackRes = await fetch(`${API_BASE}/auth/upload-document`, {
          method: 'POST',
          body: formData
        });
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      }

      return handleResponse(res);
    } catch (err) {
      // Secondary fallback if primary request had network/header issue
      try {
        const fallbackRes = await fetch(`${API_BASE}/auth/upload-document`, {
          method: 'POST',
          body: formData
        });
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch (_) {}
      throw err;
    }
  }
};

export const shopVisitService = {
  async createShopVisit(visitData) {
    const res = await fetch(`${API_BASE}/shop-visits`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(visitData)
    });
    return handleResponse(res);
  },

  async getShopVisits(params = {}) {
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'undefined' && params[k] !== 'null') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/shop-visits?${queryString}` : `${API_BASE}/shop-visits`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 404) {
      return { success: true, visits: [], total: 0 };
    }
    return handleResponse(res);
  },

  async updateShopVisit(id, updateData) {
    const res = await fetch(`${API_BASE}/shop-visits/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updateData)
    });
    return handleResponse(res);
  }
};

export const taskService = {
  async getTasks(params = {}, currentUser = null) {
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'All') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/qc-tasks/tasks?${queryString}` : `${API_BASE}/qc-tasks/tasks`;
    let data = null;
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.status === 404) {
        return { success: true, tasks: [], data: [], total: 0 };
      }
      data = await handleResponse(res);
    } catch (e) {
      console.warn('Standard tasks fetch error:', e);
    }

    if (data && data.success) {
      const list = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data.data) ? data.data : []);
      if (list.length > 0) {
        return { ...data, tasks: list, data: list, count: list.length };
      }
    }

    // If standard query needed client-side hierarchical scoping, fetch using user credentials
    try {
      const fallbackRes = await fetch(`${API_BASE}/qc-tasks/tasks`, {
        headers: getAuthHeaders()
      });
      const fallbackData = await handleResponse(fallbackRes);
      if (fallbackData && fallbackData.success) {
        const fallbackList = Array.isArray(fallbackData.tasks) ? fallbackData.tasks : (Array.isArray(fallbackData.data) ? fallbackData.data : []);
        if (fallbackList.length > 0) {
          const effectiveUser = currentUser || parseTokenUser() || {};
          const role = String(effectiveUser.role || '').toLowerCase();
          const isGlobalAdmin = ['admin', 'super_admin', 'super-admin'].some(r => role.includes(r)) || effectiveUser.email === 'admin@example.com';
          let scoped = fallbackList;
          if (!isGlobalAdmin) {
            const mLevel = Number(effectiveUser.level) || 
              (role.includes('pincode') ? 4 : role.includes('division') ? 3 : role.includes('district') ? 2 : 1);
            const norm = (s) => String(s || '').trim().toLowerCase();
            const mId = norm(effectiveUser.id || effectiveUser._id || effectiveUser.managerId);
            const mStateId = norm(effectiveUser.stateId || effectiveUser.scope?.stateId || effectiveUser.regionId || effectiveUser.scope?.regionId);
            const mState = norm(effectiveUser.state || effectiveUser.stateName || effectiveUser.scope?.stateName);
            const mDistrictId = norm(effectiveUser.districtId || effectiveUser.scope?.districtId);
            const mDistrict = norm(effectiveUser.district || effectiveUser.districtName || effectiveUser.scope?.districtName);
            const mDivisionId = norm(effectiveUser.divisionId || effectiveUser.scope?.divisionId);
            const mDivision = norm(effectiveUser.division || effectiveUser.divisionName || effectiveUser.scope?.divisionName);
            const mPincodeId = norm(effectiveUser.pincodeId || effectiveUser.scope?.pincodeId);
            const mPincode = norm(effectiveUser.pincode || effectiveUser.pincodeCode || effectiveUser.scope?.pincodeCode);

            scoped = fallbackList.filter(t => {
              if (!t) return false;
              // Direct assignment
              const tAssignee = norm(t.assignedManagerId || t.assignedAgentId);
              if (mId && tAssignee && mId === tAssignee) return true;

              const tStateId = norm(t.stateId);
              const tState = norm(t.state || t.stateName);
              const tDistId = norm(t.districtId);
              const tDist = norm(t.district || t.districtName);
              const tDivId = norm(t.divisionId);
              const tDiv = norm(t.division || t.divisionName);
              const tPinId = norm(t.pincodeId);
              const tPin = norm(t.pincode || t.pincodeCode);
              const tLoc = norm(t.location || t.territory);

              const matchState = () => {
                if (mStateId && tStateId && mStateId === tStateId) return true;
                if (mState && tState && mState === tState) return true;
                if (mState && tLoc && tLoc.includes(mState)) return true;
                if (!mStateId && !mState) return true;
                return false;
              };

              const matchDistrict = () => {
                if (!matchState()) return false;
                if (mDistrictId && tDistId && mDistrictId === tDistId) return true;
                if (mDistrict && tDist && mDistrict === tDist) return true;
                if (mDistrict && tLoc && tLoc.includes(mDistrict)) return true;
                if (!mDistrictId && !mDistrict) return true;
                return false;
              };

              const matchDivision = () => {
                if (!matchDistrict()) return false;
                if (mDivisionId && tDivId && mDivisionId === tDivId) return true;
                if (mDivision && tDiv && mDivision === tDiv) return true;
                if (mDivision && tLoc && tLoc.includes(mDivision)) return true;
                if (!mDivisionId && !mDivision) return true;
                return false;
              };

              const matchPincode = () => {
                if (mPincodeId && tPinId && mPincodeId === tPinId) return true;
                if (mPincode && tPin && mPincode === tPin) return true;
                if (mPincode && tLoc && tLoc.includes(mPincode)) return true;
                return false;
              };

              if (mLevel === 4 || role.includes('pincode')) return matchPincode();
              if (mLevel === 3 || role.includes('division')) return matchDivision();
              if (mLevel === 2 || role.includes('district')) return matchDistrict();
              if (mLevel === 1 || role.includes('state')) return matchState();
              return false;
            });
          }
          return { success: true, count: scoped.length, tasks: scoped, data: scoped };
        }
      }
    } catch (err) {
      console.error('Tasks reader fallback failed:', err);
    }

    const empty = [];
    return data ? { ...data, tasks: empty, data: empty, count: 0 } : { success: true, count: 0, tasks: empty, data: empty };
  },

  async updateTaskStatus(id, action, data = {}) {
    const res = await fetch(`${API_BASE}/qc-tasks/tasks/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, ...data })
    });
    return handleResponse(res);
  },

  async submitSuspendRequest(id, data = {}) {
    const res = await fetch(`${API_BASE}/qc-tasks/tasks/${id}/suspend`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async createTask(taskData) {
    const res = await fetch(`${API_BASE}/qc-tasks/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    return handleResponse(res);
  }
};


export const agentService = {
  async getAgents(params = {}, currentUser = null) {
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'All') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/operations/agents?${queryString}` : `${API_BASE}/operations/agents`;
    let data = null;
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.status === 404) {
        return { success: true, agents: [], data: [], total: 0 };
      }
      data = await handleResponse(res);
    } catch (e) {
      console.warn('Standard agents fetch error:', e);
    }

    if (data && data.success) {
      const list = Array.isArray(data.agents) ? data.agents : (Array.isArray(data.data) ? data.data : []);
      return { ...data, agents: list, data: list, count: list.length };
    }

    // If server query completely failed, fallback using client-side scoping
    try {
      const fallbackRes = await fetch(`${API_BASE}/operations/agents`, {
        headers: getAuthHeaders()
      });
      const fallbackData = await handleResponse(fallbackRes);
      if (fallbackData && fallbackData.success) {
        const rawAgents = Array.isArray(fallbackData.agents) ? fallbackData.agents : (Array.isArray(fallbackData.data) ? fallbackData.data : []);
        const scoped = scopeAgentsForUser(rawAgents, currentUser);
        return { success: true, count: scoped.length, agents: scoped, data: scoped };
      }
    } catch (err) {
      console.error('Agents reader fallback failed:', err);
    }

    return { success: true, count: 0, agents: [], data: [], total: 0 };
  },

  async getAgentHierarchy() {
    const res = await fetch(`${API_BASE}/operations/agents/hierarchy`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async createAgent(data) {
    const res = await fetch(`${API_BASE}/operations/agents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
};

export const settingsService = {
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() });
    return handleResponse(res);
  },

  async updateSettings(data) {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
};

export const managerOnboardingService = {
  /** Record a Field Shop Visit */
  async createFieldVisit(data) {
    try {
      const res = await fetch(`${API_BASE}/manager-onboarding/field-visit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
      if (res.status === 404) {
        return await shopVisitService.createShopVisit(data);
      }
      return handleResponse(res);
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('404'))) {
        return await shopVisitService.createShopVisit(data);
      }
      throw err;
    }
  },

  /** Submit full Vendor Onboarding (after field visit) */
  async submitVendorOnboarding(data) {
    const formattedData = {
      ...data,
      name: data.name || data.ownerName || data.businessName,
      mobile: data.mobile || data.phone || data.businessPhone || data.ownerPhone,
      businessName: data.businessName || data.shopName,
      category: data.category || data.businessCategory || 'Products'
    };

    try {
      const res = await fetch(`${API_BASE}/manager-onboarding/submit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formattedData)
      });
      if (res.ok) return await res.json();
      if (res.status === 404) {
        return await vendorService.createVendor(formattedData);
      }
      return handleResponse(res);
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('404'))) {
        return await vendorService.createVendor(formattedData);
      }
      throw err;
    }
  },

  /** Get this manager's onboarding records */
  async getMyOnboardings(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/manager-onboarding?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  /** Admin view — all onboarding records (scoped) */
  async getAdminOnboardings(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/manager-onboarding/admin?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  /** Approve an onboarding request (Pincode Admin) */
  async approveOnboarding(id, notes = '') {
    const res = await fetch(`${API_BASE}/manager-onboarding/${id}/approve`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes })
    });
    return handleResponse(res);
  },

  /** Reject an onboarding request (Pincode Admin) */
  async rejectOnboarding(id, rejectionReason) {
    const res = await fetch(`${API_BASE}/manager-onboarding/${id}/reject`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rejectionReason })
    });
    return handleResponse(res);
  },

  /** Get single onboarding record */
  async getOnboardingById(id) {
    const res = await fetch(`${API_BASE}/manager-onboarding/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  /** Upload a storefront photo */
  async uploadStorefrontPhoto(file) {
    const formData = new FormData();
    formData.append('document', file);
    const token = localStorage.getItem('agent_mgr_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/uploads/document`, {
      method: 'POST',
      headers,
      body: formData
    });
    return handleResponse(res);
  }
};

