const rawApiUrl = import.meta.env.VITE_API_URL;
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

export const managerService = {
  async getLowerLevelManagers(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/managers?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },
  async getManagerDirectory(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/managers?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
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

  async updateVendor(id, data) {
    const res = await fetch(`${API_BASE}/vendors/${id}`, {
      method: 'PUT',
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
    if (res.status === 404) {
      return { success: true, agents: [], total: 0 };
    }
    return handleResponse(res);
  },

  async getAgentHierarchy() {
    const res = await fetch(`${API_BASE}/operations/agents/hierarchy`, { headers: getAuthHeaders() });
    if (res.status === 404) {
      return { success: true, hierarchy: [] };
    }
    return handleResponse(res);
  }
};
