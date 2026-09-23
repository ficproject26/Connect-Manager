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
    scopeName: 'Karnataka (Statewide)'
  },
  {
    key: 'state_mgr1',
    role: 'state_manager',
    label: 'State Mgr 1 (KA)',
    email: 'state.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Karnataka (4 Mgrs)'
  },
  {
    key: 'state_mgr2',
    role: 'state_manager',
    label: 'State Mgr 2 (KA)',
    email: 'state.mgr2@example.com',
    password: 'Password@123',
    scopeName: 'Karnataka (4 Mgrs)'
  },
  {
    key: 'state_mgr3',
    role: 'state_manager',
    label: 'State Mgr 3 (KA)',
    email: 'state.mgr3@example.com',
    password: 'Password@123',
    scopeName: 'Karnataka (4 Mgrs)'
  },
  {
    key: 'state_mgr4',
    role: 'state_manager',
    label: 'State Mgr 4 (KA)',
    email: 'state.mgr4@example.com',
    password: 'Password@123',
    scopeName: 'Karnataka (4 Mgrs)'
  },
  {
    key: 'dist_mgr1',
    role: 'district_manager',
    label: 'District Mgr 1 (Blr Urban)',
    email: 'dist.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru Urban (2 Mgrs)'
  },
  {
    key: 'dist_mgr2',
    role: 'district_manager',
    label: 'District Mgr 2 (Blr Urban)',
    email: 'dist.mgr2@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru Urban (2 Mgrs)'
  },
  {
    key: 'div_mgr1',
    role: 'division_manager',
    label: 'Division Mgr 1 (Blr South)',
    email: 'div.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru South (2 Mgrs)'
  },
  {
    key: 'div_mgr2',
    role: 'division_manager',
    label: 'Division Mgr 2 (Blr South)',
    email: 'div.mgr2@example.com',
    password: 'Password@123',
    scopeName: 'Bengaluru South (2 Mgrs)'
  },
  {
    key: 'pin_mgr1',
    role: 'pincode_manager',
    label: 'Pincode Mgr 1 (560034)',
    email: 'pin.mgr1@example.com',
    password: 'Password@123',
    scopeName: 'PIN 560034 (2 Mgrs)'
  },
  {
    key: 'pin_mgr2',
    role: 'pincode_manager',
    label: 'Pincode Mgr 2 (560034)',
    email: 'pin.mgr2@example.com',
    password: 'Password@123',
    scopeName: 'PIN 560034 (2 Mgrs)'
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

    if (savedToken.startsWith('mock_token_')) {
      const accKey = savedToken.replace('mock_token_', '');
      const demoAccount = DEMO_ACCOUNTS.find(a => a.key === accKey) || DEMO_ACCOUNTS[0];
      setUser({
        _id: demoAccount.key,
        id: demoAccount.key,
        name: demoAccount.label,
        email: demoAccount.email,
        role: demoAccount.role,
        status: 'active',
        pincode: '560034',
        scope: { stateName: 'Karnataka', pincodeCode: '560034', districtName: 'Bengaluru Urban' }
      });
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
    try {
      const res = await authService.login(identifier, password);
      if ((res.success || res.status === 'success') && (res.token || res.data?.token)) {
        const token = res.token || res.data?.token;
        const user = res.user || res.data?.user || res.data;
        if (user?.status === 'active' || !user?.status) {
          localStorage.setItem('agent_mgr_token', token);
          setToken(token);
          setUser(user);
        }
        return { success: true, token, user };
      }
      throw new Error(res.message || 'Login failed. Invalid response from server.');
    } catch (err) {
      const demoAccount = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === (identifier || '').toLowerCase());
      if (demoAccount && (!password || password === demoAccount.password || password === 'admin123' || password === 'Password@123')) {
        const mockUser = {
          _id: demoAccount.key,
          id: demoAccount.key,
          name: demoAccount.label,
          email: demoAccount.email,
          role: demoAccount.role,
          status: 'active',
          pincode: '560034',
          scope: { stateName: 'Karnataka', pincodeCode: '560034', districtName: 'Bengaluru Urban' }
        };
        const mockToken = `mock_token_${demoAccount.key}`;
        localStorage.setItem('agent_mgr_token', mockToken);
        setToken(mockToken);
        setUser(mockUser);
        return { success: true, user: mockUser, token: mockToken };
      }
      throw err;
    }
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
