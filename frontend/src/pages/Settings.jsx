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
  Sparkles
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

        {/* Section 4: Security, Session & RBAC Policy */}
        <div className="card" style={{ width: '100%', marginTop: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#0ea5e9" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
              Security & Session Governance
            </h3>
          </div>
          <div className="card-body" style={{ padding: '20px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              • <strong>JWT Expiry:</strong> 8 hours with automatic session renewal on active portal interactions.
            </p>
            <p style={{ marginBottom: '8px' }}>
              • <strong>Data Masking:</strong> Sensitive identifiers (PAN, Aadhaar & Bank Account numbers) are automatically masked by default in all directory lists and vendor tables.
            </p>
            <p>
              • <strong>Geographic Enforcement:</strong> Direct API calls outside your authorized territory are intercepted and rejected server-side with HTTP 403 Forbidden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
