import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { User, Shield, Key, MapPin, CheckCircle2, AlertCircle, Clock, Sparkles, Lock, Eye, EyeOff, Camera, Upload, Trash2, X, Check, RefreshCw, Landmark, Copy, Edit3 } from 'lucide-react';

const Profile = () => {
  const { user, setSession, refreshUser } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const res = await authService.getMe();
        if (res && res.success && res.user && setSession) {
          setSession(res.user);
        }
      } catch (e) {
        if (refreshUser) refreshUser();
      }
    })();
  }, []);

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '', feedback: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    // Common weak patterns
    if (/^(password|123456|12345678|admin|qwerty)/i.test(pass) || pass.length < 6) {
      score = 1;
    }

    if (score <= 2) {
      return { score: 1, label: 'Weak', color: '#ef4444', bg: '#fee2e2', feedback: 'Requires at least 8 chars with uppercase, lowercase, and numbers' };
    } else if (score <= 3) {
      return { score: 2, label: 'Medium', color: '#f59e0b', bg: '#fef3c7', feedback: 'Moderate strength. Add special characters for a strong password' };
    } else {
      return { score: 3, label: 'Strong', color: '#10b981', bg: '#dcfce7', feedback: 'Strong password meeting all security requirements' };
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Bank details visibility & copy state
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState(null);

  // Bank details edit modal state
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    bankName: '',
    branchName: '',
    city: '',
    street: '',
    accountNumber: '',
    ifscCode: ''
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  const openBankModal = () => {
    setBankForm({
      accountHolderName: user?.bankDetails?.accountHolderName || user?.name || '',
      bankName: user?.bankDetails?.bankName || '',
      branchName: user?.bankDetails?.branchName || '',
      city: user?.bankDetails?.city || '',
      street: user?.bankDetails?.street || '',
      accountNumber: user?.bankDetails?.accountNumber || '',
      ifscCode: user?.bankDetails?.ifscCode || ''
    });
    setBankError('');
    setBankSuccess('');
    setBankModalOpen(true);
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    setBankError('');
    setBankSuccess('');

    try {
      const res = await authService.updateBankDetails(bankForm);
      if (res.success) {
        setBankSuccess('Bank details saved and persisted to database successfully.');
        if (refreshUser) await refreshUser();
        setTimeout(() => {
          setBankModalOpen(false);
          setBankSuccess('');
        }, 1200);
      }
    } catch (err) {
      setBankError(err.message || 'Failed to save bank details.');
    } finally {
      setBankSaving(false);
    }
  };

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
        if (res.passwordChangedAt && setSession && user) {
          setSession({
            ...user,
            passwordChangedAt: res.passwordChangedAt
          });
        }
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

  const isUnderReview = user?.status === 'under_review' || user?.overallRegistrationStatus === 'PENDING_SUB_ADMIN_APPROVAL' || user?.overallRegistrationStatus === 'PENDING_MAIN_ADMIN_APPROVAL';

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Manager Profile & Security</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Manage your account credentials, security settings, and geographic scope details
        </p>
      </div>

      {/* Under Review Informational Banner */}
      {isUnderReview && (
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#f59e0b',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: 0 }}>
                Account Under Administrative Review
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
                Pending Authorization
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '3px', margin: 0 }}>
              Your account is currently progressing through the administrative approval pipeline. Sub-admin territorial authorization, Main Admin approval, and KYC clearance are required.
            </p>
          </div>
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
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(() => {
                    const role = (user?.role || '').toLowerCase();
                    const stateVal = user?.scope?.stateName || user?.stateName || user?.state;
                    const distVal = user?.scope?.districtName || user?.districtName || user?.district;
                    const divVal = user?.scope?.divisionName || user?.divisionName || user?.division;
                    const pinVal = user?.scope?.pincodeCode || user?.pincodeCode || user?.pincode;
                    const pinArea = (user?.scope?.pincodeArea || user?.pincodeArea || user?.area || '').trim();

                    const isState = role === 'state_manager' || user?.level === 1;
                    const isDistrict = role === 'district_manager' || user?.level === 2;
                    const isDivision = role === 'division_manager' || user?.level === 3;

                    if (isState) {
                      return stateVal ? <div><strong>State:</strong> {stateVal}</div> : <div style={{ color: '#94a3b8' }}>State not assigned</div>;
                    }

                    if (isDistrict) {
                      return (
                        <>
                          {stateVal && <div><strong>State:</strong> {stateVal}</div>}
                          {distVal && <div><strong>District:</strong> {distVal}</div>}
                        </>
                      );
                    }

                    if (isDivision) {
                      return (
                        <>
                          {stateVal && <div><strong>State:</strong> {stateVal}</div>}
                          {distVal && <div><strong>District:</strong> {distVal}</div>}
                          {divVal && <div><strong>Division:</strong> {divVal}</div>}
                        </>
                      );
                    }

                    return (
                      <>
                        {stateVal && <div><strong>State:</strong> {stateVal}</div>}
                        {distVal && <div><strong>District:</strong> {distVal}</div>}
                        {divVal && <div><strong>Division:</strong> {divVal}</div>}
                        {pinVal && (
                          <div>
                            <strong>Pincode:</strong> {pinVal}{pinArea ? ` (${pinArea})` : ''}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Account Details Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Landmark size={18} color="var(--primary)" /> Bank Account Details
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {user?.bankDetails && (
                <span style={{
                  background: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  Registered
                </span>
              )}
              <button
                type="button"
                onClick={openBankModal}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#0284c7',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Edit3 size={12} />
                <span>{user?.bankDetails ? 'Edit Details' : 'Add Bank Details'}</span>
              </button>
            </div>
          </div>
          <div className="card-body">
            {user?.bankDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Account Holder Name
                  </label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    {user.bankDetails.accountHolderName || '-'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>
                      Bank Name
                    </label>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                      {user.bankDetails.bankName || '-'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>
                      Branch Name
                    </label>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                      {user.bankDetails.branchName || '-'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>
                      City
                    </label>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                      {user.bankDetails.city || '-'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>
                      Branch Street / Address
                    </label>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: user.bankDetails.street ? 'inherit' : 'var(--text-muted)' }}>
                      {user.bankDetails.street || 'Not provided'}
                    </div>
                  </div>
                </div>

                {/* Account Number with Mask / Reveal & Copy */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      Account Number
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6366f1',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 6px'
                        }}
                      >
                        {showAccountNumber ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showAccountNumber ? 'Mask' : 'Reveal'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (user.bankDetails.accountNumber) {
                            navigator.clipboard.writeText(user.bankDetails.accountNumber);
                            setCopiedBankField('account');
                            setTimeout(() => setCopiedBankField(null), 2000);
                          }
                        }}
                        style={{
                          background: copiedBankField === 'account' ? '#dcfce7' : '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          color: copiedBankField === 'account' ? '#15803d' : '#475569',
                          fontWeight: 600
                        }}
                      >
                        <Copy size={11} />
                        <span>{copiedBankField === 'account' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace', color: '#0f172a' }}>
                    {showAccountNumber
                      ? user.bankDetails.accountNumber
                      : (user.bankDetails.accountNumber ? `•••• •••• •••• ${String(user.bankDetails.accountNumber).slice(-4)}` : '-')}
                  </div>
                </div>

                {/* IFSC Code with Copy */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      IFSC Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (user.bankDetails.ifscCode) {
                          navigator.clipboard.writeText(user.bankDetails.ifscCode);
                          setCopiedBankField('ifsc');
                          setTimeout(() => setCopiedBankField(null), 2000);
                        }
                      }}
                      style={{
                        background: copiedBankField === 'ifsc' ? '#dcfce7' : '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        color: copiedBankField === 'ifsc' ? '#15803d' : '#475569',
                        fontWeight: 600
                      }}
                    >
                      <Copy size={11} />
                      <span>{copiedBankField === 'ifsc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace', color: '#0f172a' }}>
                    {user.bankDetails.ifscCode || '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 'var(--radius-sm)',
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <Landmark size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Bank details not provided
                </div>
                <p style={{ fontSize: '0.78rem', margin: '0 0 14px' }}>
                  No banking details are currently recorded for this account. You can submit or update your banking details below.
                </p>
                <button
                  type="button"
                  onClick={openBankModal}
                  style={{
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Landmark size={14} />
                  <span>Add Bank Account Details</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Edit Bank Details */}
        {bankModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={20} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {user?.bankDetails ? 'Update Bank Account Details' : 'Add Bank Account Details'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveBankDetails} style={{ padding: '24px' }}>
                {bankError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: '0.82rem',
                    marginBottom: '16px'
                  }}>
                    {bankError}
                  </div>
                )}
                {bankSuccess && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    fontSize: '0.82rem',
                    marginBottom: '16px'
                  }}>
                    {bankSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={bankForm.accountHolderName}
                      onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                      placeholder="e.g. Balavignesh"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                        Bank Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={bankForm.bankName}
                        onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                        placeholder="e.g. HDFC Bank"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                        Branch Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={bankForm.branchName}
                        onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                        placeholder="e.g. Vandalur"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={bankForm.city}
                        onChange={(e) => setBankForm({ ...bankForm, city: e.target.value })}
                        placeholder="e.g. Chengalpattu"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                        Street / Address
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={bankForm.street}
                        onChange={(e) => setBankForm({ ...bankForm, street: e.target.value })}
                        placeholder="Optional address"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                      Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={bankForm.accountNumber}
                      onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="9 to 18 digit account number"
                      maxLength={18}
                      style={{ width: '100%', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={bankForm.ifscCode}
                      onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      maxLength={11}
                      style={{ width: '100%', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setBankModalOpen(false)}
                    className="btn btn-secondary"
                    disabled={bankSaving}
                    style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bankSaving}
                    style={{ padding: '8px 22px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {bankSaving && <RefreshCw size={14} className="animate-spin" />}
                    <span>{bankSaving ? 'Saving...' : 'Save Bank Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

            {/* Last Password Changed Information */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.8rem'
            }}>
              <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Last password changed:
              </span>
              <span style={{ fontWeight: 600, color: user?.passwordChangedAt ? '#0f172a' : '#94a3b8' }}>
                {user?.passwordChangedAt
                  ? new Date(user.passwordChangedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Not recorded'}
              </span>
            </div>

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
                    placeholder="Minimum 8 characters"
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

                {/* Password Strength Indicator */}
                {newPassword && (() => {
                  const strength = getPasswordStrength(newPassword);
                  return (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Password Strength:</span>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: strength.color,
                          background: strength.bg,
                          padding: '1px 8px',
                          borderRadius: '10px'
                        }}>
                          {strength.label}
                        </span>
                      </div>
                      <div style={{ height: '4px', width: '100%', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', display: 'flex', gap: '3px' }}>
                        <div style={{ flex: 1, background: strength.score >= 1 ? strength.color : '#e2e8f0', borderRadius: '2px', transition: 'all 0.2s' }} />
                        <div style={{ flex: 1, background: strength.score >= 2 ? strength.color : '#e2e8f0', borderRadius: '2px', transition: 'all 0.2s' }} />
                        <div style={{ flex: 1, background: strength.score >= 3 ? strength.color : '#e2e8f0', borderRadius: '2px', transition: 'all 0.2s' }} />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: strength.score < 3 ? '#94a3b8' : '#15803d', marginTop: '4px' }}>
                        {strength.feedback}
                      </div>
                    </div>
                  );
                })()}
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
