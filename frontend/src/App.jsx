import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import VendorRequests from './pages/VendorRequests';
import Issues from './pages/Issues';
import Performance from './pages/Performance';
import Leaderboard from './pages/Leaderboard';
import Notifications from './pages/Notifications';
import AddVendor from './pages/AddVendor';
import EditVendor from './pages/EditVendor';
import VendorDetails from './pages/VendorDetails';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import FieldManagers from './pages/FieldManagers';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  // Navigation State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authPage, setAuthPage] = useState('login'); // 'login' | 'forgot-password' | 'reset-password'
  const [navParams, setNavParams] = useState({});

  const navigate = (page, params = {}) => {
    setNavParams(params);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAuth = (page, params = {}) => {
    setNavParams(params);
    setAuthPage(page);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        color: '#f59e0b',
        fontSize: '1.2rem',
        fontWeight: 700
      }}>
        Initializing Forge India Connect Portal...
      </div>
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    if (authPage === 'register') {
      return (
        <Register
          onNavigate={navigateAuth}
          initialUser={navParams.user}
          initialFlowState={navParams.flowState}
          initialToken={navParams.token}
        />
      );
    }
    if (authPage === 'forgot-password') {
      return <ForgotPassword onNavigate={navigateAuth} />;
    }
    if (authPage === 'reset-password') {
      return <ResetPassword onNavigate={navigateAuth} token={navParams.token} />;
    }
    return <Login onNavigate={navigateAuth} />;
  }

  return (
    <div className="app-shell">
      {/* Role-Aware Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={navigate} />

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        <Navbar onNavigate={navigate} />

        <main className="content-body">
          {currentPage === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {currentPage === 'vendor-requests' && <VendorRequests onNavigate={navigate} />}
          {currentPage === 'vendors' && <Vendors onNavigate={navigate} filterParams={navParams} />}
          {currentPage === 'issues' && <Issues onNavigate={navigate} />}
          {currentPage === 'performance' && <Performance onNavigate={navigate} />}
          {currentPage === 'leaderboard' && <Leaderboard onNavigate={navigate} />}
          {currentPage === 'notifications' && <Notifications onNavigate={navigate} />}
          {currentPage === 'field-managers' && <FieldManagers onNavigate={navigate} />}
          {currentPage === 'add-vendor' && <AddVendor onNavigate={navigate} />}
          {currentPage === 'edit-vendor' && <EditVendor vendorId={navParams.vendorId} onNavigate={navigate} />}
          {currentPage === 'vendor-details' && <VendorDetails vendorId={navParams.vendorId} onNavigate={navigate} />}
          {currentPage === 'reports' && <Reports onNavigate={navigate} />}
          {currentPage === 'audit-logs' && <AuditLogs onNavigate={navigate} />}
          {currentPage === 'profile' && <Profile onNavigate={navigate} />}
          {currentPage === 'settings' && <Settings onNavigate={navigate} />}
        </main>
      </div>
    </div>
  );
}
