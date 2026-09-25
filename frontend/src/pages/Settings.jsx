import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Lock, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { settingsService } from '../services/api';

const Settings = () => {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [kycAlerts, setKycAlerts] = useState(true);
  const [statusChangeAlerts, setStatusChangeAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [autoAssignTasks, setAutoAssignTasks] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SettingsIcon size={22} color="var(--forge-gold-vibrant)" />
          Portal Settings
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Manage your notification alerts, operational workflows, and security preferences
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="card" style={{ width: '100%', marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary)" /> Field Notification Preferences
            </h3>
          </div>
          <form onSubmit={handleSave} className="card-body">
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={kycAlerts}
                      onChange={(e) => setKycAlerts(e.target.checked)}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>New Vendor Submissions</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Receive instant notifications whenever a vendor submits onboarding data in your jurisdiction.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={statusChangeAlerts}
                      onChange={(e) => setStatusChangeAlerts(e.target.checked)}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Status Transition Notifications</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Notify when vendors are approved, rejected, or moved to Under Review.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Daily Digest Email</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Receive daily summary of all active, pending, and rejected vendors in your branch.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoAssignTasks}
                      onChange={(e) => setAutoAssignTasks(e.target.checked)}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Auto-Assign Tasks to Field Agents</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Automatically allocate pending verification tasks to active agents in matching territories.
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="card" style={{ width: '100%', marginTop: 0 }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="#0ea5e9" /> Security & Session Policy
            </h3>
          </div>
          <div className="card-body" style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '8px' }}>
              • <strong>JWT Expiry:</strong> 8 hours with automatic session renewal.
            </p>
            <p style={{ marginBottom: '8px' }}>
              • <strong>Data Masking:</strong> Sensitive identifiers (PAN & Bank Account) are automatically masked by default in all directory lists.
            </p>
            <p>
              • <strong>Geographic Enforcement:</strong> Direct API calls outside your assigned area are intercepted and rejected server-side with 403 Forbidden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
