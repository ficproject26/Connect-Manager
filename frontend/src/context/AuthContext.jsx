import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { realtimeClient } from '../realtime';
import { cacheClient } from '../services/cacheClient';
import { dataPrefetcher } from '../services/dataPrefetcher';

const AuthContext = createContext(null);


const normalizeUser = (u) => {
  if (!u) return null;
  const scope = u.scope || {};
  const territory = u.territory || {};
  const role = String(u.role || '').toLowerCase();
  const level = Number(u.level) || (role.includes('state') ? 1 : role.includes('district') ? 2 : role.includes('division') ? 3 : 4);

  // Authoritative jurisdiction values
  const stateVal = u.state || u.stateName || territory.state || scope.stateName || scope.regionName || 'Tamil Nadu';
  const stateIdVal = u.stateId || territory.stateId || scope.stateId || u.regionId || scope.regionId || '6aa10f70ca0932e6eaec1f5c';

  const distVal = level >= 2 ? (u.district || u.districtName || territory.district || scope.districtName || null) : null;
  const distIdVal = level >= 2 ? (u.districtId || territory.districtId || scope.districtId || null) : null;

  const divVal = level >= 3 ? (u.division || u.divisionName || territory.division || scope.divisionName || null) : null;
  const divIdVal = level >= 3 ? (u.divisionId || territory.divisionId || scope.divisionId || null) : null;

  const pinVal = level >= 4 ? (u.pincode || u.pincodeCode || territory.pincode || territory.pincodeCode || scope.pincodeCode || null) : null;
  const pinIdVal = level >= 4 ? (u.pincodeId || territory.pincodeId || scope.pincodeId || null) : null;
  const pinAreaVal = level >= 4 ? (u.pincodeArea || territory.pincodeArea || scope.pincodeArea || u.area || null) : null;

  const resolvedAvatar = u.avatarUrl || u.avatar || u.profilePhoto || u.image || u.profileImage || null;

  return {
    ...u,
    id: u.id || u._id,
    _id: u._id || u.id,
    managerId: u.managerId || u.id || u._id,
    level,
    avatarUrl: resolvedAvatar,
    stateId: stateIdVal,
    state: stateVal,
    stateName: stateVal,
    districtId: distIdVal,
    district: distVal,
    districtName: distVal,
    divisionId: divIdVal,
    division: divVal,
    divisionName: divVal,
    pincodeId: pinIdVal,
    pincode: pinVal,
    pincodeCode: pinVal,
    pincodeArea: pinAreaVal,
    territory: {
      ...territory,
      state: stateVal,
      district: distVal,
      division: divVal,
      pincode: pinVal,
      pincodeArea: pinAreaVal
    },
    scope: {
      ...scope,
      stateId: stateIdVal,
      stateName: stateVal,
      districtId: distIdVal,
      districtName: distVal,
      divisionId: divIdVal,
      divisionName: divVal,
      pincodeId: pinIdVal,
      pincodeCode: pinVal,
      pincodeArea: pinAreaVal
    }
  };
};

const isTokenExpired = (tokenStr) => {
  if (!tokenStr || typeof tokenStr !== 'string') return true;
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('agent_mgr_token');
    if (!savedToken || isTokenExpired(savedToken)) {
      if (savedToken) localStorage.removeItem('agent_mgr_token');
      localStorage.removeItem('agent_mgr_user');
      return null;
    }
    const savedUser = localStorage.getItem('agent_mgr_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const st = String(parsed?.status || '').toLowerCase().trim();
        if (st === 'active' || st === 'approved') {
          return normalizeUser(parsed);
        }
      } catch (e) {}
    }
    try {
      const parts = savedToken.split('.');
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed = JSON.parse(jsonPayload);
      const st = String(parsed.status || '').toLowerCase().trim();
      if (st === 'active' || st === 'approved') {
        return normalizeUser(parsed);
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const updateActiveUser = (u) => {
    const normalized = normalizeUser(u);
    setUser(normalized);
    if (normalized) {
      try {
        localStorage.setItem('agent_mgr_user', JSON.stringify(normalized));
      } catch (e) {}
    } else {
      localStorage.removeItem('agent_mgr_user');
    }
    return normalized;
  };
  const [pendingUser, setPendingUser] = useState(null);
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('agent_mgr_token');
    if (saved && !isTokenExpired(saved)) return saved;
    if (saved) localStorage.removeItem('agent_mgr_token');
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const saved = localStorage.getItem('agent_mgr_token');
    return Boolean(saved && !isTokenExpired(saved));
  });

  const logout = () => {
    localStorage.removeItem('agent_mgr_token');
    localStorage.removeItem('agent_mgr_user');
    cacheClient.clear();
    dataPrefetcher.reset();
    setToken(null);
    setUser(null);
    setPendingUser(null);
    realtimeClient.disconnect();
  };

  const initAuth = async () => {
    const savedToken = localStorage.getItem('agent_mgr_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    // Immediately purge any stale/legacy mock tokens or expired tokens
    if (savedToken.startsWith('mock_token_') || isTokenExpired(savedToken)) {
      logout();
      setLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      if (res && res.success && res.user) {
        const userStatus = String(res.user.status || '').toLowerCase().trim();
        if (userStatus === 'active' || userStatus === 'approved') {
          updateActiveUser(res.user);
          setPendingUser(null);
        } else {
          // Manager registration is not fully approved - lock dashboard access
          logout();
          setPendingUser(normalizeUser(res.user));
        }
      } else if (res && (res.status === 401 || res.status === 403 || res.message?.includes('Unauthorized') || res.message?.includes('Invalid token'))) {
        logout();
      }
    } catch (err) {
      if (err.status === 403 && err.data?.user) {
        // Approval required or blocked
        logout();
        setPendingUser(normalizeUser(err.data.user));
      } else {
        console.warn('[AuthContext] initAuth network warning:', err?.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (token && user) {
      cacheClient.setCurrentUser(user);
      realtimeClient.connect(token);
      dataPrefetcher.prefetchForUser(user);
    } else if (!token) {
      realtimeClient.disconnect();
    }
  }, [token, user]);

  // Keep session alive while active
  useEffect(() => {
    if (!token || !user) return;
    const interval = setInterval(async () => {
      try {
        const res = await authService.refreshToken();
        if (res.success && res.token) {
          localStorage.setItem('agent_mgr_token', res.token);
          setToken(res.token);
        }
      } catch {
        // Silently ignore background refresh failures
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
    return () => clearInterval(interval);
  }, [token, user]);

  const login = async (identifier, password) => {
    try {
      const res = await authService.login(identifier, password);
      if ((res.success || res.status === 'success') && (res.token || res.data?.token)) {
        const token = res.token || res.data?.token;
        const rawUser = res.user || res.data?.user || res.data;
        const normalized = normalizeUser(rawUser);
        const userStatus = String(normalized?.status || '').toLowerCase().trim();

        if (userStatus === 'active' || userStatus === 'approved') {
          localStorage.setItem('agent_mgr_token', token);
          setToken(token);
          updateActiveUser(normalized);
          setPendingUser(null);
          return { success: true, isApproved: true, token, user: normalized };
        } else {
          // Unapproved user: strictly never grant dashboard session
          logout();
          setPendingUser(normalized);
          return {
            success: false,
            isApproved: false,
            isPendingApproval: true,
            approvalStatus: normalized.status,
            user: normalized,
            message: 'Manager registration approval is pending. Dashboard access is locked.'
          };
        }
      }
      throw new Error(res.message || 'Login failed. Invalid response from server.');
    } catch (err) {
      if (err.data && (err.data.code === 'APPROVAL_REQUIRED' || err.data.code === 'REGISTRATION_REJECTED')) {
        logout();
        const pending = normalizeUser(err.data.user);
        if (pending) setPendingUser(pending);
        return {
          success: false,
          isApproved: false,
          isPendingApproval: err.data.code === 'APPROVAL_REQUIRED',
          isRejected: err.data.code === 'REGISTRATION_REJECTED',
          code: err.data.code,
          approvalStatus: err.data.approvalStatus,
          adminApprovalStatus: err.data.adminApprovalStatus,
          kycStatus: err.data.kycStatus,
          rejectionReason: err.data.rejectionReason,
          user: pending,
          message: err.message
        };
      }
      throw err;
    }
  };

  const loginWithOtp = async (mobile, otp) => {
    try {
      const res = await authService.verifyOtp(mobile, otp);
      if ((res.success || res.status === 'success') && (res.token || res.data?.token)) {
        const token = res.token || res.data?.token;
        const rawUser = res.user || res.data?.user || res.data;
        const normalized = normalizeUser(rawUser);
        const userStatus = String(normalized?.status || '').toLowerCase().trim();

        if (userStatus === 'active' || userStatus === 'approved') {
          localStorage.setItem('agent_mgr_token', token);
          setToken(token);
          updateActiveUser(normalized);
          setPendingUser(null);
          return { success: true, isApproved: true, token, user: normalized };
        } else {
          logout();
          setPendingUser(normalized);
          return {
            success: false,
            isApproved: false,
            isPendingApproval: true,
            approvalStatus: normalized.status,
            user: normalized,
            message: 'Manager registration approval is pending. Dashboard access is locked.'
          };
        }
      }
      throw new Error(res.message || 'OTP verification failed.');
    } catch (err) {
      if (err.data && (err.data.code === 'APPROVAL_REQUIRED' || err.data.code === 'REGISTRATION_REJECTED')) {
        logout();
        const pending = normalizeUser(err.data.user);
        if (pending) setPendingUser(pending);
        return {
          success: false,
          isApproved: false,
          isPendingApproval: err.data.code === 'APPROVAL_REQUIRED',
          isRejected: err.data.code === 'REGISTRATION_REJECTED',
          code: err.data.code,
          approvalStatus: err.data.approvalStatus,
          adminApprovalStatus: err.data.adminApprovalStatus,
          kycStatus: err.data.kycStatus,
          rejectionReason: err.data.rejectionReason,
          user: pending,
          message: err.message
        };
      }
      throw err;
    }
  };

  const setSession = (userData, tokenString) => {
    const normalized = normalizeUser(userData);
    const userStatus = String(normalized?.status || '').toLowerCase().trim();
    if (userStatus === 'active' || userStatus === 'approved') {
      if (tokenString) {
        localStorage.setItem('agent_mgr_token', tokenString);
        setToken(tokenString);
      }
      updateActiveUser(normalized);
      setPendingUser(null);
    } else {
      logout();
      setPendingUser(normalized);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        const userStatus = String(res.user.status || '').toLowerCase().trim();
        if (userStatus === 'active' || userStatus === 'approved') {
          updateActiveUser(res.user);
        } else {
          logout();
          setPendingUser(normalizeUser(res.user));
        }
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const isAuthenticated = Boolean(
    user && (String(user.status || '').toLowerCase() === 'active' || String(user.status || '').toLowerCase() === 'approved')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        pendingUser,
        setPendingUser,
        token,
        loading,
        login,
        loginWithOtp,
        logout,
        setSession,
        refreshUser,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
