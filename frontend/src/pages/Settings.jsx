import React, { useState } from 'react';
import { Settings as SettingsIcon, Bell, Lock, Shield, CheckCircle2 } from 'lucide-react';

const Settings = () => {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [kycAlerts, setKycAlerts] = useState(true);
  const [statusChangeAlerts, setStatusChangeAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Portal Settings</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Manage your notification alerts, operational workflows, and security preferences
        </p>
      </div>

      <div style={{ maxWidth: '700px' }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary)" /> Field Notification Preferences
            </h3>
          </div>
          <form onSubmit={handleSave} className="card-body">
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
                <span>Preferences saved successfully.</span>
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
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Save Preferences
              </button>
            </div>
          </form>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
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
