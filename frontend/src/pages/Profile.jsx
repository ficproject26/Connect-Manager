import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { User, Shield, Key, MapPin, CheckCircle2, AlertCircle, Clock, Sparkles, Lock, Eye, EyeOff, Camera, Upload, Trash2, X, Check, RefreshCw } from 'lucide-react';

const Profile = () => {
  const { user, setSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Profile photo state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setPhotoSuccess('');

    // Strict client-side validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setPhotoError('Invalid image format. Please select a JPG, PNG, or WEBP file.');
      e.target.value = '';
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File size exceeds 5MB limit. Please select a smaller photo.');
      e.target.value = '';
      return;
    }

    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleCancelPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSavePhoto = async () => {
    if (!photoFile) return;
    setPhotoLoading(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const res = await authService.updateProfilePhoto(photoFile);
      if (res && res.success && res.avatarUrl) {
        setSession({
          ...user,
          avatarUrl: res.avatarUrl
        });
        setPhotoSuccess('Profile photo updated successfully!');
        handleCancelPhoto();
        setTimeout(() => setPhotoSuccess(''), 4000);
      } else {
        setPhotoError(res?.message || 'Failed to update profile photo.');
      }
    } catch (err) {
      setPhotoError(err.message || 'Error updating profile photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const res = await authService.removeProfilePhoto();
      if (res && res.success) {
        setSession({
          ...user,
          avatarUrl: null
        });
        setConfirmRemove(false);
        setPhotoSuccess('Profile photo removed successfully.');
        setTimeout(() => setPhotoSuccess(''), 4000);
      } else {
        setPhotoError(res?.message || 'Failed to remove profile photo.');
      }
    } catch (err) {
      setPhotoError(err.message || 'Error removing profile photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>
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
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
                {/* Avatar with action */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    border: '2.5px solid var(--border)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerText = user?.name?.slice(0, 2).toUpperCase() || 'SU';
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>
                        {user?.name?.slice(0, 2).toUpperCase() || 'SU'}
                      </span>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                  />

                  {/* Camera overlay button on avatar */}
                  {!photoPreview && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoLoading}
                      title={user?.avatarUrl ? "Change Photo" : "Upload Photo"}
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: 'var(--forge-gold, #f59e0b)',
                        color: '#0f172a',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                      }}
                    >
                      <Camera size={13} />
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                    {user?.email}
                  </div>

                  {/* Action buttons */}
                  {photoPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={handleSavePhoto}
                        disabled={photoLoading}
                        style={{
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: 'var(--forge-gold, #f59e0b)',
                          color: '#0f172a',
                          cursor: photoLoading ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        {photoLoading ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check size={12} />
                            <span>Save Photo</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelPhoto}
                        disabled={photoLoading}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={12} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photoLoading}
                        style={{
                          padding: '5px 11px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#f8fafc',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Camera size={12} color="var(--forge-gold, #f59e0b)" />
                        <span>{user?.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>

                      {user?.avatarUrl && !confirmRemove && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(true)}
                          disabled={photoLoading}
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #fee2e2',
                            background: '#fff5f5',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Remove</span>
                        </button>
                      )}

                      {confirmRemove && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fee2e2', padding: '3px 8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>Remove photo?</span>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            disabled={photoLoading}
                            style={{
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(false)}
                            style={{
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              border: '1px solid #fca5a5',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Feedback alerts */}
              {photoSuccess && (
                <div style={{
                  padding: '8px 12px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 size={14} />
                  <span>{photoSuccess}</span>
                </div>
              )}
              {photoError && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertCircle size={14} />
                  <span>{photoError}</span>
                </div>
              )}

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
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    className="form-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{
                      paddingLeft: '38px',
                      paddingRight: '40px',
                      fontSize: '0.86rem',
                      height: '42px',
                      borderRadius: '8px',
                      borderColor: '#cbd5e1',
                      background: '#f8fafc',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: showCurrentPassword ? 'var(--primary, #0ea5e9)' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 600 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    className="form-input"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      paddingLeft: '38px',
                      paddingRight: '40px',
                      fontSize: '0.86rem',
                      height: '42px',
                      borderRadius: '8px',
                      borderColor: '#cbd5e1',
                      background: '#f8fafc',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: showNewPassword ? 'var(--primary, #0ea5e9)' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      paddingLeft: '38px',
                      paddingRight: '40px',
                      fontSize: '0.86rem',
                      height: '42px',
                      borderRadius: '8px',
                      borderColor: '#cbd5e1',
                      background: '#f8fafc',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: showConfirmPassword ? 'var(--primary, #0ea5e9)' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
