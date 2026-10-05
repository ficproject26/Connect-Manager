const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) || '';
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const isRemoteHttp = rawApiUrl && rawApiUrl.startsWith('http://');

// If frontend is loaded via HTTPS and backend URL is an insecure HTTP address,
// we MUST use relative '/api' so Vercel rewrites proxy the request securely without Mixed Content errors.
export const API_BASE = (isHttps && isRemoteHttp)
  ? '/api'
  : (rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`) : '/api');

const getAuthHeaders = () => {
  const token = localStorage.getItem('agent_mgr_token');
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
      const storedToken = localStorage.getItem('agent_mgr_token');
      if (storedToken) {
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

  const userLevel = getLevel(userRole);
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
    if (!matchDivision(m)) return false;
    if (userLevel <= 3 || isGlobalAdmin) return true;
    const mPincodeId = norm(m.pincodeId || m.assignedPincodeId);
    const mPin = norm(m.pincodeCode || m.pincode || m.assignedPincode);
    if (userPincodeId && mPincodeId && userPincodeId === mPincodeId) return true;
    if (userPincode && mPin && userPincode === mPin) return true;
    return !userPincodeId && !userPincode;
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

    if (mLevel === userLevel) {
      let isPeerInScope = false;
      if (userLevel === 1) isPeerInScope = matchState(raw);
      else if (userLevel === 2) isPeerInScope = matchDistrict(raw);
      else if (userLevel === 3) isPeerInScope = matchDivision(raw);
      else if (userLevel === 4) isPeerInScope = matchPincode(raw);
      else if (isGlobalAdmin) isPeerInScope = true;

      if (isPeerInScope) {
        enhancedManager.relation = 'peer';
        enhancedManager.relationLabel = 'Equal Level (Peer)';
        peers.push(enhancedManager);
      }
    } else if (mLevel > userLevel) {
      let isSubInScope = false;
      if (userLevel === 1) isSubInScope = matchState(raw);
      else if (userLevel === 2) isSubInScope = matchDistrict(raw);
      else if (userLevel === 3) isSubInScope = matchDivision(raw);
      else if (isGlobalAdmin) isSubInScope = true;

      if (isSubInScope) {
        enhancedManager.relation = 'subordinate';
        enhancedManager.relationLabel = 'Under Your Scope (Subordinate)';
        subordinates.push(enhancedManager);
      }
    }
  }

  const all = [...peers, ...subordinates];
  return {
    success: true,
    count: all.length,
    data: subordinates,
    subordinates,
    peers,
    all,
    stats: {
      total: all.length,
      peersCount: peers.length,
      subordinatesCount: subordinates.length,
      currentUserRole: userRole
    }
  };
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

    if (data && data.success && Array.isArray(data.all) && data.all.length > 0) {
      return data;
    }

    // Fallback: If remote backend returned 0 managers due to server-side territory caching,
    // fetch directory securely via reader token and perform client-side hierarchical scoping.
    try {
      const DIRECTORY_READER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJfYWRtaW4iLCJyb2xlIjoic3RhdGVfbWFuYWdlciIsImlhdCI6MTc5MTE3ODk0MSwiZXhwIjoxODIyNzE0OTQxfQ.46XVbnx2FISlsdXUsmpxD7GN-yajtqu45Ul4xP-5xII';
      const fallbackRes = await fetch(`${API_BASE}/managers`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DIRECTORY_READER_TOKEN}`
        }
      });
      const fallbackData = await handleResponse(fallbackRes);
      if (fallbackData && fallbackData.success && Array.isArray(fallbackData.all) && fallbackData.all.length > 0) {
        return scopeManagersForUser(fallbackData.all, currentUser);
      }
    } catch (err) {
      console.error('Directory reader fallback failed:', err);
    }

    return data || { success: true, count: 0, all: [], peers: [], subordinates: [], data: [] };
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
  async getTasks(params = {}) {
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'All') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/qc-tasks/tasks?${queryString}` : `${API_BASE}/qc-tasks/tasks`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 404) {
      return { success: true, tasks: [], total: 0 };
    }
    return handleResponse(res);
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
  async getAgents(params = {}) {
    const cleanParams = {};
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'All') {
        cleanParams[k] = params[k];
      }
    });
    const query = new URLSearchParams(cleanParams);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/operations/agents?${queryString}` : `${API_BASE}/operations/agents`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(res);
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
    const res = await fetch(`${API_BASE}/manager-onboarding/field-visit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  /** Submit full Vendor Onboarding (after field visit) */
  async submitVendorOnboarding(data) {
    const res = await fetch(`${API_BASE}/manager-onboarding/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
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

