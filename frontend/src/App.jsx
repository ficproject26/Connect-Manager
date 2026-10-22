import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Primary Core Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Resilient dynamic import that automatically reloads the page once on version/chunk deployment mismatch
const lazyWithRetry = (factory) =>
  React.lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const isChunkError = err && (
        err.name === 'ChunkLoadError' ||
        /dynamically imported module/i.test(err.message || '') ||
        /failed to fetch/i.test(err.message || '')
      );
      if (isChunkError) {
        const lastReload = Number(sessionStorage.getItem('last_chunk_reload') || 0);
        const now = Date.now();
        if (now - lastReload > 10000) {
          sessionStorage.setItem('last_chunk_reload', String(now));
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });

// Lazy-loaded routes with automatic reload resilience against stale production chunk hashes
const Register = lazyWithRetry(() => import('./pages/Register'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const Vendors = lazyWithRetry(() => import('./pages/Vendors'));
const VendorRequests = lazyWithRetry(() => import('./pages/VendorRequests'));
const Tasks = lazyWithRetry(() => import('./pages/Tasks'));
const Issues = lazyWithRetry(() => import('./pages/Issues'));
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const AddVendor = lazyWithRetry(() => import('./pages/AddVendor'));
const VendorForm = lazyWithRetry(() => import('./components/VendorForm'));
const VendorDetails = lazyWithRetry(() => import('./pages/VendorDetails'));
const Reports = lazyWithRetry(() => import('./pages/Reports'));
const AuditLogs = lazyWithRetry(() => import('./pages/AuditLogs'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const FieldManagers = lazyWithRetry(() => import('./pages/FieldManagers'));
const AgentDirectory = lazyWithRetry(() => import('./pages/AgentDirectory'));
const ShopVisits = lazyWithRetry(() => import('./pages/ShopVisits'));
const FieldShopVisitModal = lazyWithRetry(() => import('./components/FieldShopVisitModal'));
import { managerOnboardingService, vendorService, shopVisitService } from './services/api';

const PageFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '320px',
    width: '100%',
    color: '#94a3b8',
    padding: '40px 20px'
  }}>
    <div style={{
      width: 32,
      height: 32,
      border: '3px solid rgba(59, 130, 246, 0.2)',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginBottom: 12
    }} />
    <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Loading view...</span>
  </div>
);


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
    const isChunkError = error && (
      error.name === 'ChunkLoadError' ||
      /dynamically imported module/i.test(error.message || '') ||
      /failed to fetch/i.test(error.message || '')
    );
    if (isChunkError) {
      const lastReload = Number(sessionStorage.getItem('last_boundary_reload') || 0);
      const now = Date.now();
      if (now - lastReload > 10000) {
        sessionStorage.setItem('last_boundary_reload', String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && (
        this.state.error.name === 'ChunkLoadError' ||
        /dynamically imported module/i.test(this.state.error.message || '') ||
        /failed to fetch/i.test(this.state.error.message || '')
      );

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
            border: isChunkError ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '24px 30px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isChunkError ? '#60a5fa' : '#f87171', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '20px' }}>{isChunkError ? '🔄' : '⚠️'}</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {isChunkError ? 'Portal Update Available' : 'Manager Portal Runtime Notice'}
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: isChunkError ? '#93c5fd' : '#fca5a5', fontWeight: 600, margin: '0 0 16px 0' }}>
              {isChunkError
                ? 'A new version of the Manager Portal was deployed. Please reload the page to load the latest application components.'
                : this.state.error?.toString()}
            </p>
            {this.state.errorInfo?.componentStack && !isChunkError && (
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

  // Navigation State with URL synchronization
  const getInitialNavigation = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      const hash = window.location.hash.replace(/^#\/?/, '');
      let page = pageParam || hash || 'dashboard';
      if (page === 'issues') page = 'tasks';

      const initialParams = {};
      for (const [key, value] of params.entries()) {
        if (key !== 'page') initialParams[key] = value;
      }
      return { page, initialParams };
    } catch (_) {
      return { page: 'dashboard', initialParams: {} };
    }
  };

  const initialNav = useMemo(getInitialNavigation, []);
  const [currentPage, setCurrentPage] = useState(initialNav.page);
  const [visitedPages, setVisitedPages] = useState(() => new Set(['dashboard', initialNav.page]));
  const [authPage, setAuthPage] = useState('login'); // 'login' | 'forgot-password' | 'reset-password'
  const [navParams, setNavParams] = useState(initialNav.initialParams);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [fieldVisitModalOpen, setFieldVisitModalOpen] = useState(false);
  const [pendingFieldVisitId, setPendingFieldVisitId] = useState(null);
  const [pendingPrefill, setPendingPrefill] = useState({});
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('manager_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('manager_theme', theme);
  }, [theme]);

  const openOnboard = () => {
    setFieldVisitModalOpen(true);
    setOnboardModalOpen(false);
    setPendingFieldVisitId(null);
    setPendingPrefill({});
  };

  const handleFieldVisitProceed = (fieldVisitId, prefillData) => {
    setFieldVisitModalOpen(false);
    setPendingFieldVisitId(fieldVisitId);
    setPendingPrefill(prefillData || {});
    setOnboardModalOpen(true);
  };

  const navigate = (page, params = {}) => {
    if (page === 'resume-onboarding' || page === 'resume-onboard') {
      const fId = params.fieldVisitId || params._id || params.id || null;
      const prefill = params.prefillData || params;
      handleFieldVisitProceed(fId, prefill);
      return;
    }
    let targetPage = page;
    if (targetPage === 'issues') targetPage = 'tasks';

    setNavParams(params);
    setCurrentPage(targetPage);
    setVisitedPages(prev => {
      if (prev.has(targetPage)) return prev;
      const next = new Set(prev);
      next.add(targetPage);
      return next;
    });
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Sync URL without full page reload
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', targetPage);
      // Clean up previous query params
      Array.from(url.searchParams.keys()).forEach(k => {
        if (k !== 'page' && !params[k]) url.searchParams.delete(k);
      });
      Object.entries(params).forEach(([k, v]) => {
        if (v && typeof v === 'string') url.searchParams.set(k, v);
      });
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  const navigateAuth = (page, params = {}) => {
    setNavParams(params);
    setAuthPage(page);
  };

  // Loading State: Prevent flicker of login or protected screens while verifying session
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44,
            height: 44,
            margin: '0 auto 16px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' }}>Verifying manager authorization...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    if (authPage === 'register') {
      return (
        <React.Suspense fallback={<PageFallback />}>
          <Register
            onNavigate={navigateAuth}
            initialUser={navParams.user}
            initialFlowState={navParams.flowState}
            initialToken={navParams.token}
            initialRejectionReason={navParams.rejectionReason}
          />
        </React.Suspense>
      );
    }
    if (authPage === 'forgot-password') {
      return (
        <React.Suspense fallback={<PageFallback />}>
          <ForgotPassword onNavigate={navigateAuth} />
        </React.Suspense>
      );
    }
    if (authPage === 'reset-password') {
      return (
        <React.Suspense fallback={<PageFallback />}>
          <ResetPassword onNavigate={navigateAuth} token={navParams.token} />
        </React.Suspense>
      );
    }
    return <Login onNavigate={navigateAuth} />;
  }

  return (
    <div className="app-shell">
      {/* Role-Aware Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={navigate} 
        onOpenOnboard={openOnboard} 
        mobileOpen={mobileSidebarOpen} 
        onCloseMobile={() => setMobileSidebarOpen(false)} 
      />

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        <Navbar 
          onNavigate={navigate} 
          onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} 
        />

        <main className="content-body">
          <React.Suspense fallback={<PageFallback />}>
            {visitedPages.has('dashboard') && (
              <div style={{ display: currentPage === 'dashboard' ? 'block' : 'none', width: '100%' }}>
                <Dashboard onNavigate={navigate} />
              </div>
            )}
          {/* VendorRequests page removed */}
          {visitedPages.has('vendors') && (
            <div style={{ display: currentPage === 'vendors' ? 'block' : 'none', width: '100%' }}>
              <Vendors onNavigate={navigate} filterParams={navParams} onOpenOnboard={openOnboard} />
            </div>
          )}
          {currentPage === 'vendor-requests' && <VendorRequests onNavigate={navigate} />}
          {visitedPages.has('tasks') && (
            <div style={{ display: currentPage === 'tasks' ? 'block' : 'none', width: '100%' }}>
              <Tasks onNavigate={navigate} filterParams={navParams} />
            </div>
          )}
          {visitedPages.has('issues') && (
            <div style={{ display: currentPage === 'issues' ? 'block' : 'none', width: '100%' }}>
              <Issues onNavigate={navigate} filterParams={navParams} />
            </div>
          )}
          {visitedPages.has('leaderboard') && (
            <div style={{ display: currentPage === 'leaderboard' ? 'block' : 'none', width: '100%' }}>
              <Leaderboard onNavigate={navigate} />
            </div>
          )}
          {visitedPages.has('notifications') && (
            <div style={{ display: currentPage === 'notifications' ? 'block' : 'none', width: '100%' }}>
              <Notifications onNavigate={navigate} />
            </div>
          )}
          {visitedPages.has('field-managers') && (
            <div style={{ display: currentPage === 'field-managers' ? 'block' : 'none', width: '100%' }}>
              <FieldManagers onNavigate={navigate} filterParams={navParams} />
            </div>
          )}
          {(visitedPages.has('agents-directory') || visitedPages.has('agent-directory')) && (
            <div style={{ display: (currentPage === 'agents-directory' || currentPage === 'agent-directory') ? 'block' : 'none', width: '100%' }}>
              <AgentDirectory onNavigate={navigate} />
            </div>
          )}
          {visitedPages.has('shop-visits') && (
            <div style={{ display: currentPage === 'shop-visits' ? 'block' : 'none', width: '100%' }}>
              <Reports onNavigate={navigate} initialTab="shop-visits" filterParams={navParams} />
            </div>
          )}
          {/* add-vendor page kept as fallback */}
          {currentPage === 'add-vendor' && <AddVendor onNavigate={navigate} />}


          {/* Step 1 — Field Shop Visit Modal (gateway to vendor onboarding) */}
          {fieldVisitModalOpen && (
            <FieldShopVisitModal
              onClose={() => setFieldVisitModalOpen(false)}
              onProceedToOnboarding={handleFieldVisitProceed}
            />
          )}

          {/* Step 2 — Vendor Onboarding Form (after field visit YES) */}
          {onboardModalOpen && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px'
            }}>
              <div
                onClick={() => setOnboardModalOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              />
              <div style={{
                position: 'relative', width: '100%', maxWidth: 680,
                maxHeight: 'min(94vh, 840px)',
                background: 'var(--bg)', borderRadius: 18,
                boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
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
                  >x</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  <VendorForm
                    prefill={pendingPrefill}
                    initialData={pendingPrefill}
                    fieldVisitId={pendingFieldVisitId}
                    onSubmit={async (formData) => {
                      const payload = {
                        ...formData,
                        name: formData.name || formData.ownerName || formData.businessName,
                        mobile: formData.mobile || formData.phone || formData.businessPhone || formData.ownerPhone,
                        businessName: formData.businessName || formData.shopName,
                        category: formData.category || formData.businessCategory || 'Products',
                        fieldVisitId: pendingFieldVisitId,
                        storefrontPhoto: formData.storefrontPhoto || pendingPrefill?.storefrontPhoto,
                        shopPhoto: formData.storefrontPhoto || pendingPrefill?.storefrontPhoto,
                        documents: Array.isArray(formData.documents) && formData.documents.length > 0
                          ? formData.documents
                          : (pendingPrefill?.storefrontPhoto
                              ? [{
                                  url: pendingPrefill.storefrontPhoto,
                                  name: 'Storefront On-Ground Photo.jpg',
                                  filename: pendingPrefill.storefrontPhoto.split('/').pop(),
                                  type: 'image/jpeg'
                                }]
                              : [])
                      };

                      let res;
                      const existingDraftId = pendingPrefill?._id || pendingPrefill?.id;
                      try {
                        if (existingDraftId) {
                          res = await vendorService.updateVendor(existingDraftId, payload);
                        } else if (pendingFieldVisitId) {
                          res = await managerOnboardingService.submitVendorOnboarding(payload);
                        } else {
                          res = await vendorService.createVendor(payload);
                        }
                      } catch (err) {
                        if (existingDraftId) {
                          res = await vendorService.updateVendor(existingDraftId, payload);
                        } else {
                          res = await vendorService.createVendor(payload);
                        }
                      }

                      if (res && (res.success || res.status === 'success')) {
                        const createdVendorId = res.data?._id || res.data?.id;
                        if (pendingFieldVisitId && createdVendorId) {
                          try {
                            const isApproved = res.data?.status === 'Approved' || res.data?.status === 'Active';
                            await shopVisitService.updateShopVisit(pendingFieldVisitId, {
                              vendorId: createdVendorId,
                              onboardingStatus: isApproved ? 'COMPLETED' : 'INCOMPLETE',
                              status: isApproved ? 'Onboarded' : 'Onboarding In Progress'
                            });
                          } catch (e) {
                            console.warn('Failed to link shop visit with vendor:', e);
                          }
                        }
                        setOnboardModalOpen(false);
                        setPendingFieldVisitId(null);
                        setPendingPrefill({});
                        navigate('vendors');
                      }
                    }}
                    onCancel={() => setOnboardModalOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}
                    {currentPage === 'vendor-details' && <VendorDetails vendorId={navParams.vendorId} onNavigate={navigate} />}
          {visitedPages.has('reports') && (
            <div style={{ display: currentPage === 'reports' ? 'block' : 'none', width: '100%' }}>
              <Reports onNavigate={navigate} initialTab={navParams.tab || 'vendors'} filterParams={navParams} />
            </div>
          )}
          {visitedPages.has('audit-logs') && (
            <div style={{ display: currentPage === 'audit-logs' ? 'block' : 'none', width: '100%' }}>
              <AuditLogs onNavigate={navigate} />
            </div>
          )}
          {visitedPages.has('profile') && (
            <div style={{ display: currentPage === 'profile' ? 'block' : 'none', width: '100%' }}>
              <Profile onNavigate={navigate} />
            </div>
          )}
          {visitedPages.has('settings') && (
            <div style={{ display: currentPage === 'settings' ? 'block' : 'none', width: '100%' }}>
              <Settings onNavigate={navigate} currentTheme={theme} onToggleTheme={setTheme} />
            </div>
          )}
          </React.Suspense>
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





