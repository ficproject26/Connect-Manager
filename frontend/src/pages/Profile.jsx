import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { User, Shield, Key, MapPin, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';

const Profile = () => {
  const { user, setSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Simulate approval state
  const [simulating, setSimulating] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      if (res.success) {
        setMessage('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateApproval = async () => {
    if (!user?.id) return;
    setSimulating(true);
    setApprovalSuccess('');
    setApprovalError('');

    try {
      const res = await authService.simulateApproval(user.id);
      if (res.success) {
        setSession(res.user, res.token);
        setApprovalSuccess('Profile successfully approved! Full manager access is now activated.');
      }
    } catch (err) {
      setApprovalError(err.message || 'Failed to simulate admin approval.');
    } finally {
      setSimulating(false);
    }
  };

  const isUnderReview = user?.status === 'under_review';

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Manager Profile & Security</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Manage your account credentials, security settings, and geographic scope details
        </p>
      </div>

      {/* Under Review Simulated Approval Banner */}
      {isUnderReview && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '1.5px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', maxWidth: '600px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#f59e0b',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
                  Account Status: Under Administrative Review
                </h4>
                <span style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  Pending Approval
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '4px', margin: 0 }}>
                Your registration has been submitted. Since the Admin Portal is not yet integrated, you can simulate administrative approval below to activate full manager capabilities.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSimulateApproval}
            disabled={simulating}
            className="btn btn-primary"
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}
          >
            <Sparkles size={16} />
            {simulating ? 'Approving...' : 'Simulate Admin Approval'}
          </button>
        </div>
      )}

      {/* Approval Success Banner */}
      {approvalSuccess && (
        <div style={{
          padding: '12px 16px',
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: 'var(--radius-sm)',
          color: '#15803d',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.875rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{approvalSuccess}</span>
        </div>
      )}

      {/* Approval Error Banner */}
      {approvalError && (
        <div style={{
          padding: '12px 16px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius-sm)',
          color: '#b91c1c',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <span>{approvalError}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Profile Details & Scope */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--primary)" /> Profile Information
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Photo & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: '2px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6366f1' }}>
                      {user?.name?.slice(0, 2).toUpperCase() || 'MG'}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{user?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)' }}>Account Status</label>
                <div>
                  {user?.status === 'active' ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      ● Active & Authorized
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      ● Under Review
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)' }}>Role Level</label>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eef2ff', color: '#4338ca', padding: '4px 12px', borderRadius: '12px', fontWeight: 600, fontSize: '0.85rem' }}>
                  <Shield size={14} /> Level {user?.level}: {user?.role?.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)' }}>Official Email</label>
                <div style={{ fontSize: '0.95rem' }}>{user?.email}</div>
              </div>

              <div>
                <label className="form-label" style={{ color: 'var(--text-muted)' }}>Registered Mobile</label>
                <div style={{ fontSize: '0.95rem' }}>+91 {user?.mobile}</div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <label className="form-label" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="var(--primary)" /> Assigned Jurisdiction
                </label>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                  {user?.scope?.stateName && <div><strong>State:</strong> {user.scope.stateName}</div>}
                  {user?.scope?.districtName && <div><strong>District:</strong> {user.scope.districtName}</div>}
                  {user?.scope?.divisionName && <div><strong>Division:</strong> {user.scope.divisionName}</div>}
                  {user?.scope?.pincodeCode && (
                    <div>
                      <strong>Pincode:</strong> {user.scope.pincodeCode} ({user.scope.pincodeArea || ''})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="#0ea5e9" /> Change Password
            </h3>
          </div>
          <div className="card-body">
            {message && (
              <div style={{
                padding: '12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-sm)',
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontSize: '0.875rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 'var(--radius-sm)',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontSize: '0.875rem'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
                disabled={saving}
              >
                {saving ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
