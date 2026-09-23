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
import Tasks from './pages/Tasks';
import Issues from './pages/Tasks';
import Leaderboard from './pages/Leaderboard';
import Notifications from './pages/Notifications';
import AddVendor from './pages/AddVendor';
import VendorForm from './components/VendorForm';
import EditVendor from './pages/EditVendor';
import VendorDetails from './pages/VendorDetails';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import FieldManagers from './pages/FieldManagers';
import AgentDirectory from './pages/AgentDirectory';
import ShopVisits from './pages/ShopVisits';


class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Manager GlobalErrorBoundary caught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '40px 20px',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            maxWidth: '650px',
            width: '100%',
            backgroundColor: '#1e293b',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '24px 30px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Manager Portal Runtime Notice</h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#fca5a5', fontWeight: 600, margin: '0 0 16px 0' }}>
              {this.state.error?.toString()}
            </p>
            {this.state.errorInfo?.componentStack && (
              <pre style={{
                fontSize: '0.75rem',
                color: '#cbd5e1',
                backgroundColor: '#090d16',
                padding: '14px',
                borderRadius: '10px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                border: '1px solid #334155',
                maxHeight: '220px',
                marginBottom: '20px'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#f59e0b',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('agent_mgr_token');
                  window.location.reload();
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Reset Session & Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const { isAuthenticated, loading } = useAuth();

  // Navigation State
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authPage, setAuthPage] = useState('login'); // 'login' | 'forgot-password' | 'reset-password'
  const [navParams, setNavParams] = useState({});
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);

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
      <Sidebar currentPage={currentPage} onNavigate={navigate} onOpenOnboard={() => setOnboardModalOpen(true)} />

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        <Navbar onNavigate={navigate} />

        <main className="content-body">
          {currentPage === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {/* VendorRequests page removed */}
          {currentPage === 'vendors' && <Vendors onNavigate={navigate} onOpenOnboard={() => setOnboardModalOpen(true)} />}
          {currentPage === 'vendor-requests' && <VendorRequests onNavigate={navigate} />}
          {(currentPage === 'tasks' || currentPage === 'issues') && <Tasks onNavigate={navigate} />}
          {currentPage === 'leaderboard' && <Leaderboard onNavigate={navigate} />}
          {currentPage === 'notifications' && <Notifications onNavigate={navigate} />}
          {currentPage === 'field-managers' && <FieldManagers onNavigate={navigate} />}
          {(currentPage === 'agents-directory' || currentPage === 'agent-directory') && <AgentDirectory onNavigate={navigate} />}
          {currentPage === 'shop-visits' && <Reports onNavigate={navigate} initialTab="shop-visits" />}
          {/* add-vendor page kept as fallback */}
          {currentPage === 'add-vendor' && <AddVendor onNavigate={navigate} />}

          {/* Onboard Vendor Popup Modal */}
          {onboardModalOpen && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px'
            }}>
              {/* backdrop */}
              <div
                onClick={() => setOnboardModalOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              />
              {/* modal card */}
              <div style={{
                position: 'relative', width: '100%', maxWidth: 680,
                maxHeight: 'min(90vh, 820px)',
                background: 'var(--bg)', borderRadius: 18,
                boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
                {/* header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 24px 14px',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0
                }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Vendor Onboarding</h2>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Register and onboard a new business within your assigned scope
                    </p>
                  </div>
                  <button
                    onClick={() => setOnboardModalOpen(false)}
                    style={{
                      width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--surface)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, color: 'var(--text-muted)',
                      flexShrink: 0
                    }}
                  >×</button>
                </div>
                {/* scrollable body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  <VendorForm
                    onSubmit={async (formData) => {
                      const { vendorService } = await import('./services/api');
                      const res = await vendorService.createVendor(formData);
                      if (res.success) {
                        setOnboardModalOpen(false);
                        navigate('vendors');
                      }
                    }}
                    onCancel={() => setOnboardModalOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}
          {currentPage === 'edit-vendor' && <EditVendor vendorId={navParams.vendorId} onNavigate={navigate} />}
          {currentPage === 'vendor-details' && <VendorDetails vendorId={navParams.vendorId} onNavigate={navigate} />}
          {currentPage === 'reports' && <Reports onNavigate={navigate} initialTab={navParams.tab || 'vendors'} />}
          {currentPage === 'audit-logs' && <AuditLogs onNavigate={navigate} />}
          {currentPage === 'profile' && <Profile onNavigate={navigate} />}
          {currentPage === 'settings' && <Settings onNavigate={navigate} />}
        </main>
      </div>
    </div>
  );
}


export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppInner />
    </GlobalErrorBoundary>
  );
}
