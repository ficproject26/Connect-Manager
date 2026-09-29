import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { realtimeClient } from '../realtime';

const AuthContext = createContext(null);


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('agent_mgr_token') || null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('agent_mgr_token');
    setToken(null);
    setUser(null);
    realtimeClient.disconnect();
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

  useEffect(() => {
    if (token && user) {
      realtimeClient.connect(token);
    } else if (!token) {
      realtimeClient.disconnect();
    }
  }, [token, user]);

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
