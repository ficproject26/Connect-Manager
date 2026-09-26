import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const DEMO_ACCOUNTS = [
  {
    key: 'admin',
    role: 'state_manager',
    label: 'System Admin (Statewide)',
    email: 'admin@example.com',
    password: 'admin123',
    scopeName: 'Tamil Nadu (Statewide)'
  },
  {
    key: 'state',
    role: 'state_manager',
    label: 'State Manager (Tamil Nadu)',
    email: 'state.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Tamil Nadu (Statewide)'
  },
  {
    key: 'district',
    role: 'district_manager',
    label: 'District Manager (BLR Urban)',
    email: 'dist.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru Urban District'
  },
  {
    key: 'division',
    role: 'division_manager',
    label: 'Division Manager (BLR South)',
    email: 'div.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru South Division'
  },
  {
    key: 'pincode',
    role: 'pincode_manager',
    label: 'PIN Code Manager (560034)',
    email: 'pin.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'PIN 560034 (Koramangala)'
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('agent_mgr_token') || null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('agent_mgr_token');
    setToken(null);
    setUser(null);
  };

  const initAuth = async () => {
    const savedToken = localStorage.getItem('agent_mgr_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    // Immediately purge any stale/legacy mock tokens
    if (savedToken.startsWith('mock_token_')) {
      logout();
      setLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        logout();
      }
    } catch (err) {
      console.warn('Session verification failed, logging out:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (identifier, password) => {
    const res = await authService.login(identifier, password);
    if ((res.success || res.status === 'success') && (res.token || res.data?.token)) {
      const token = res.token || res.data?.token;
      const user = res.user || res.data?.user || res.data;
      const status = String(user?.status || '').toLowerCase();
      if (status === 'active' || status === 'approved' || !user?.status) {
        localStorage.setItem('agent_mgr_token', token);
        setToken(token);
        setUser(user);
      }
      return { success: true, token, user };
    }
    throw new Error(res.message || 'Login failed. Invalid response from server.');
  };

  const loginWithOtp = async (mobile, otp) => {
    const res = await authService.verifyOtp(mobile, otp);
    if ((res.success || res.status === 'success') && (res.token || res.data?.token)) {
      const token = res.token || res.data?.token;
      const user = res.user || res.data?.user || res.data;
      const status = String(user?.status || '').toLowerCase();
      if (status === 'active' || status === 'approved' || !user?.status) {
        localStorage.setItem('agent_mgr_token', token);
        setToken(token);
        setUser(user);
      }
      return { success: true, token, user };
    }
    throw new Error(res.message || 'OTP verification failed.');
  };

  const quickSwitchRole = async (accountKey) => {
    const target = DEMO_ACCOUNTS.find(a => a.key === accountKey);
    if (!target) return;
    setLoading(true);
    try {
      await login(target.email, target.password);
    } catch (err) {
      console.error('Quick switch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const setSession = (userData, tokenString) => {
    if (tokenString) {
      localStorage.setItem('agent_mgr_token', tokenString);
      setToken(tokenString);
    }
    setUser(userData);
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithOtp,
        logout,
        setSession,
        quickSwitchRole,
        refreshUser,
        isAuthenticated: !!user
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
