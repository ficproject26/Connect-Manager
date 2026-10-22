import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Lock, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sun, 
  Moon, 
  MapPin, 
  Eye, 
  Check, 
  Sliders,
  Sparkles,
  Laptop,
  Smartphone,
  Globe,
  LogOut,
  Clock
} from 'lucide-react';
import { settingsService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Settings = ({ currentTheme = 'light', onToggleTheme }) => {
  const { user } = useAuth();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [kycAlerts, setKycAlerts] = useState(true);
  const [statusChangeAlerts, setStatusChangeAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [autoAssignTasks, setAutoAssignTasks] = useState(true);
  
  // Theme state (local fallback if props not provided)
  const [theme, setTheme] = useState(() => {
    return currentTheme || localStorage.getItem('manager_theme') || 'light';
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Active Sessions & Timeout Governance State (Issue 29)
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(30);
  const [updatingTimeout, setUpdatingTimeout] = useState(false);
  const [sessionActionMsg, setSessionActionMsg] = useState('');

  useEffect(() => {
    if (currentTheme) {
      setTheme(currentTheme);
    }
  }, [currentTheme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('manager_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (onToggleTheme) {
      onToggleTheme(newTheme);
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await settingsService.getActiveSessions();
      if (res?.success) {
        setSessions(res.sessions || []);
        if (res.inactivityTimeout) {
          setInactivityTimeout(res.inactivityTimeout);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleTimeoutChange = async (e) => {
    const val = parseInt(e.target.value, 10);
    setInactivityTimeout(val);
    try {
      setUpdatingTimeout(true);
      await settingsService.updateInactivityTimeout(val);
      setSessionActionMsg(`Inactivity timeout updated to ${val} minutes.`);
      setTimeout(() => setSessionActionMsg(''), 3500);
    } catch (err) {
      console.error('Failed to update inactivity timeout:', err);
    } finally {
      setUpdatingTimeout(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await settingsService.revokeSession(sessionId);
      setSessionActionMsg('Session terminated successfully.');
      setTimeout(() => setSessionActionMsg(''), 3500);
      loadSessions();
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  };

  const handleRevokeAllOther = async () => {
    const current = sessions.find(s => s.isCurrent);
    const curId = current?._id || current?.id;
    try {
      await settingsService.revokeAllOtherSessions(curId);
      setSessionActionMsg('All other sessions have been logged out.');
      setTimeout(() => setSessionActionMsg(''), 3500);
      loadSessions();
    } catch (err) {
      console.error('Failed to revoke other sessions:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await settingsService.getSettings();
        if (isMounted && (res.data || res.settings)) {
          const cfg = res.data || res.settings;
          setEmailAlerts(cfg.emailAlerts !== undefined ? cfg.emailAlerts : true);
          setKycAlerts(cfg.kycAlerts !== undefined ? cfg.kycAlerts : true);
          setStatusChangeAlerts(cfg.statusChangeAlerts !== undefined ? cfg.statusChangeAlerts : true);
          setDailyDigest(cfg.dailyDigest !== undefined ? cfg.dailyDigest : true);
          setAutoAssignTasks(cfg.autoAssignTasks !== undefined ? cfg.autoAssignTasks : true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load portal settings from database:', err);
          setError('Failed to fetch settings from database. Please try again.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadSettings();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateSettings({
        emailAlerts,
        kycAlerts,
        statusChangeAlerts,
        dailyDigest,
        autoAssignTasks
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      console.error('Failed to save portal settings:', err);
      setError('Failed to save settings to the database.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (r) => {
    switch (r) {
      case 'state_manager': return 'State Manager (Level 1)';
      case 'district_manager': return 'District Manager (Level 2)';
      case 'division_manager': return 'Division Manager (Level 3)';
      case 'pincode_manager': return 'Pincode Manager (Level 4)';
      default: return r ? r.replace(/_/g, ' ') : 'Manager';
    }
  };

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SettingsIcon size={22} color="var(--forge-gold)" />
          Portal Settings & Preferences
        </h2>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          Customize visual theme display, operational notifications, and regional field security parameters
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Visual Theme & Appearance (Bug 30) */}
        <div className="card" style={{ width: '100%', marginBottom: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sun size={18} color="var(--forge-gold)" />
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
                Appearance & Theme Mode
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Select your preferred interface display mode
            </span>
          </div>

          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Light Mode Card */}
              <div 
                onClick={() => handleThemeChange('light')}
                style={{
                  border: theme === 'light' ? '2px solid #f59e0b' : '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md, 12px)',
                  padding: '16px',
                  background: theme === 'light' ? '#fffbeb' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: theme === 'light' ? '0 4px 12px rgba(245, 158, 11, 0.15)' : 'none'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: theme === 'light' ? '#f59e0b' : '#f1f5f9',
                  color: theme === 'light' ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sun size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Light Mode</span>
                    {theme === 'light' && (
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    High-contrast daylight theme
                  </div>
                </div>
              </div>

              {/* Dark Mode Card */}
              <div 
                onClick={() => handleThemeChange('dark')}
                style={{
                  border: theme === 'dark' ? '2px solid #6366f1' : '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md, 12px)',
                  padding: '16px',
                  background: theme === 'dark' ? '#1e1b4b' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: theme === 'dark' ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: theme === 'dark' ? '#6366f1' : '#f1f5f9',
                  color: theme === 'dark' ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Moon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: theme === 'dark' ? '#ffffff' : 'var(--text-main)' }}>Dark Mode</span>
                    {theme === 'dark' && (
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: theme === 'dark' ? '#cbd5e1' : 'var(--text-muted)', marginTop: '2px' }}>
                    Sleek dark theme for night field ops
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Field Notification Preferences */}
        <div className="card" style={{ width: '100%', marginBottom: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
                Field Notification Preferences
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Configure operational event alerts
            </span>
          </div>

          <form onSubmit={handleSave} className="card-body" style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.875rem' }}>Loading settings from database...</p>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{
                    padding: '12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-sm)',
                    color: '#b91c1c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '20px',
                    fontSize: '0.875rem'
                  }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {saved && (
                  <div style={{
                    padding: '12px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 'var(--radius-sm)',
                    color: '#065f46',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '20px',
                    fontSize: '0.875rem'
                  }}>
                    <CheckCircle2 size={16} />
                    <span>Settings persisted to database successfully.</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      checked={kycAlerts}
                      onChange={(e) => setKycAlerts(e.target.checked)}
                      style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>New Vendor Submissions</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Receive instant notifications whenever a vendor submits onboarding data in your jurisdiction.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      checked={statusChangeAlerts}
                      onChange={(e) => setStatusChangeAlerts(e.target.checked)}
                      style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Status Transition Notifications</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Notify when vendors are approved, rejected, or moved to Under Review.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Daily Digest Email</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Receive daily summary of all active, pending, and rejected vendors in your branch.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      checked={autoAssignTasks}
                      onChange={(e) => setAutoAssignTasks(e.target.checked)}
                      style={{ marginTop: '4px', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Auto-Assign Tasks to Field Agents</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Automatically allocate pending verification tasks to active agents in matching territories.
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 20px', fontWeight: 700 }}>
                    {saving && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                    {saving ? 'Saving Preferences...' : 'Save Notification Preferences'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        {/* Section 3: Manager Territory & Operational Scope */}
        <div className="card" style={{ width: '100%', marginTop: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="var(--forge-emerald)" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
              Territory Authority & Operational Role
            </h3>
          </div>
          <div className="card-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Role</span>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {roleLabel(user?.role)}
                </p>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Operating Jurisdiction</span>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {user?.stateName || user?.scope?.stateName || 'Assigned State'}
                  {user?.districtName || user?.scope?.districtName ? ` › ${user.districtName || user.scope.districtName}` : ''}
                  {user?.divisionName || user?.scope?.divisionName ? ` › ${user.divisionName || user.scope.divisionName}` : ''}
                  {user?.pincode || user?.scope?.pincode ? ` (PIN ${user.pincode || user.scope.pincode})` : ''}
                </p>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Approval Hierarchy</span>
                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>
                  Dual-Tier Verified
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Security, Session & RBAC Policy (Issue 29) */}
        <div className="card" style={{ width: '100%', marginTop: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="#0ea5e9" />
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
                Security & Session Governance
              </h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Inactivity Timeout:</span>
              <select
                value={inactivityTimeout}
                onChange={handleTimeoutChange}
                disabled={updatingTimeout}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-subtle)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>
          </div>

          <div className="card-body" style={{ padding: '20px' }}>
            {sessionActionMsg && (
              <div style={{
                padding: '8px 12px',
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={14} />
                <span>{sessionActionMsg}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>Active Login Sessions</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({sessions.length} active device{sessions.length === 1 ? '' : 's'})
                </span>
              </div>

              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeAllOther}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <LogOut size={12} /> Log Out All Other Devices
                </button>
              )}
            </div>

            {loadingSessions ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
                Loading active sessions...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sessions.map((sess, idx) => (
                  <div
                    key={sess._id || sess.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: sess.isCurrent ? '#e0f2fe' : '#f1f5f9',
                        color: sess.isCurrent ? '#0284c7' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {String(sess.device || '').toLowerCase().includes('phone') || String(sess.device || '').toLowerCase().includes('mobile') ? (
                          <Smartphone size={16} />
                        ) : (
                          <Laptop size={16} />
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                            {sess.device || 'Workstation'} &bull; {sess.browser || 'Web Browser'}
                          </span>
                          {sess.isCurrent && (
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              Current Session
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          IP: {sess.ipAddress || '127.0.0.1'} &bull; {sess.location || 'Assigned Territory'} &bull; Active {sess.lastActive ? new Date(sess.lastActive).toLocaleTimeString() : 'Just now'}
                        </div>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess._id || sess.id)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.74rem',
                          color: '#dc2626',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <span>• <strong>JWT Expiry:</strong> 8 hours with automatic session renewal on active portal interactions.</span>
              <span style={{ marginLeft: '12px' }}>• <strong>Data Masking:</strong> Sensitive identifiers (PAN, Aadhaar & Bank Details) are masked across all directories.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
