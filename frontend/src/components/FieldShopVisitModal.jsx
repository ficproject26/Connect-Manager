/**
 * FieldShopVisitModal.jsx
 * 
 * Step 0 of the Manager Vendor Onboarding workflow.
 * Captures: Shop Name, Business Category, Storefront Photo, Merchant Interest Status.
 * 
 * If Interested → calls onProceedToOnboarding(fieldVisitId, prefillData)
 * If Not Interested → saves visit, closes modal.
 */

import React, { useState, useRef } from 'react';
import { Camera, Upload, ThumbsUp, ThumbsDown, X, Store, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { managerOnboardingService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BUSINESS_CATEGORIES = [
  'Products',
  'Services',
  'Daily Needs',
  'Food',
  'Stay',
  'Travel',
  'Jobs',
  'Healthcare',
  'Education',
  'Electronics',
  'Fashion',
  'Beauty & Wellness',
  'Agriculture',
  'Finance',
  'Other'
];

const FieldShopVisitModal = ({ onClose, onProceedToOnboarding }) => {
  const { user } = useAuth();

  // Form state
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [storefrontFile, setStorefrontFile] = useState(null);
  const [storefrontPreview, setStorefrontPreview] = useState(null);
  const [storefrontUrl, setStorefrontUrl] = useState('');
  const [interestStatus, setInterestStatus] = useState(''); // 'YES' | 'NO'

  // UI state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);

  // ── Photo upload ──────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be smaller than 5MB.');
      return;
    }

    setError('');
    setStorefrontFile(file);

    // Generate local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setStorefrontPreview(reader.result);
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingPhoto(true);
    try {
      const res = await managerOnboardingService.uploadStorefrontPhoto(file);
      if (res.success && res.file?.url) {
        setStorefrontUrl(res.file.url);
        setFieldErrors(prev => ({ ...prev, storefrontPhoto: '' }));
      } else {
        setError('Photo upload failed. Please try again.');
        setStorefrontFile(null);
        setStorefrontPreview(null);
      }
    } catch (err) {
      setError('Photo upload failed: ' + (err.message || 'Server error.'));
      setStorefrontFile(null);
      setStorefrontPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    setStorefrontFile(null);
    setStorefrontPreview(null);
    setStorefrontUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Validation ────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!shopName.trim()) errs.shopName = 'Shop name is required.';
    if (!businessCategory) errs.businessCategory = 'Please select a business category.';
    if (!storefrontUrl) errs.storefrontPhoto = 'Storefront photo is required.';
    if (!interestStatus) errs.interestStatus = 'Please select merchant interest status.';
    return errs;
  };

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = {
        shopName:         shopName.trim(),
        businessCategory,
        storefrontPhoto:  storefrontUrl,
        interestStatus,
        stateId:    user?.stateId    || null,
        districtId: user?.districtId || null,
        divisionId: user?.divisionId || null,
        pincodeId:  user?.pincodeId  || null,
        pincodeCode: user?.scope?.pincodeCode || user?.pincode || null
      };

      const res = await managerOnboardingService.createFieldVisit(payload);

      if (!res.success) {
        setError(res.message || 'Failed to save field visit.');
        return;
      }

      if (interestStatus === 'NO') {
        setSuccess('Field visit saved. The merchant was not interested — no vendor account will be created.');
        setTimeout(() => onClose(), 2500);
        return;
      }

      // Merchant is interested — proceed to vendor onboarding
      onProceedToOnboarding(res.data._id, {
        shopName:         shopName.trim(),
        businessCategory,
        storefrontPhoto:  storefrontUrl
      });
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: `1.5px solid ${hasError ? '#ef4444' : '#e2e8f0'}`,
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#0f172a',
    transition: 'border-color 0.15s'
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px'
    }}>
      {/* Backdrop */}
      <div
        onClick={!submitting ? onClose : undefined}
        style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,40,0.7)', backdropFilter: 'blur(6px)' }}
      />

      {/* Modal Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '540px',
        maxHeight: '94vh',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 20px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          flexShrink: 0
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Store size={22} style={{ color: '#ffffff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              Field Shop Visit
            </h2>
            <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>
              Shop Information, Business Category, Storefront Photo &amp; Interest Status
            </p>
          </div>
          <button
            onClick={!submitting ? onClose : undefined}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Global Error / Success */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 10,
              color: '#b91c1c', fontSize: '0.83rem', fontWeight: 600,
              marginBottom: 16
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', background: '#f0fdf4',
              border: '1px solid #86efac', borderRadius: 10,
              color: '#15803d', fontSize: '0.83rem', fontWeight: 600,
              marginBottom: 16
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{success}</span>
            </div>
          )}

          {/* ── Section 1: Shop Details ── */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '16px 18px', marginBottom: 16
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0
              }}>1</div>
              <h3 style={{ margin: 0, fontSize: '0.93rem', fontWeight: 800, color: '#0f172a' }}>
                Shop Details &amp; Business Category <span style={{ color: '#ef4444' }}>*</span>
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Shop Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Shop Name / Business Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Lakshmi Supermarket"
                  value={shopName}
                  onChange={e => { setShopName(e.target.value); setFieldErrors(p => ({ ...p, shopName: '' })); }}
                  style={inputStyle(!!fieldErrors.shopName)}
                />
                {fieldErrors.shopName && (
                  <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '4px 0 0', fontWeight: 600 }}>
                    {fieldErrors.shopName}
                  </p>
                )}
              </div>

              {/* Business Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Main Business Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={businessCategory}
                  onChange={e => { setBusinessCategory(e.target.value); setFieldErrors(p => ({ ...p, businessCategory: '' })); }}
                  style={{
                    ...inputStyle(!!fieldErrors.businessCategory),
                    background: '#ffffff'
                  }}
                >
                  <option value="">Select Category...</option>
                  {BUSINESS_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {fieldErrors.businessCategory && (
                  <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '4px 0 0', fontWeight: 600 }}>
                    {fieldErrors.businessCategory}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Storefront Photo ── */}
          <div style={{
            background: '#f8fafc', border: `1px solid ${fieldErrors.storefrontPhoto ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: 14, padding: '16px 18px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0
              }}>2</div>
              <h3 style={{ margin: 0, fontSize: '0.93rem', fontWeight: 800, color: '#0f172a' }}>
                Shop Storefront Photo <span style={{ color: '#ef4444' }}>*</span>
              </h3>
            </div>

            {storefrontPreview ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Preview */}
                <div style={{
                  width: 100, height: 80, borderRadius: 10, overflow: 'hidden',
                  border: '2px solid #e2e8f0', flexShrink: 0, position: 'relative'
                }}>
                  <img
                    src={storefrontPreview}
                    alt="Storefront Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {uploadingPhoto && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: 700, color: '#15803d' }}>
                    {uploadingPhoto ? 'Uploading...' : '✓ Photo uploaded'}
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: '#64748b' }}>
                    {storefrontFile?.name}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #d97706',
                        background: '#fffbeb', color: '#d97706',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={uploadingPhoto}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                        background: '#ffffff', color: '#64748b',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {/* Placeholder box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 90, height: 76, borderRadius: 10,
                    border: '2px dashed #cbd5e1',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 4, cursor: 'pointer',
                    background: '#f1f5f9', flexShrink: 0,
                    transition: 'border-color 0.15s'
                  }}
                >
                  <Camera size={22} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>Add Photo</span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '9px 16px', borderRadius: 10,
                      border: '1.5px solid #e2e8f0', background: '#ffffff',
                      fontSize: '0.83rem', fontWeight: 700, color: '#334155',
                      cursor: 'pointer', marginBottom: 6
                    }}
                  >
                    <Upload size={15} />
                    Capture or Upload Store Photo
                  </button>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                    Clear storefront image showing the board or entrance.
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                    JPG, PNG, WEBP up to 5MB
                  </p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {fieldErrors.storefrontPhoto && (
              <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '8px 0 0', fontWeight: 600 }}>
                {fieldErrors.storefrontPhoto}
              </p>
            )}
          </div>

          {/* ── Section 3: Merchant Interest ── */}
          <div style={{
            background: '#f8fafc', border: `1px solid ${fieldErrors.interestStatus ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: 14, padding: '16px 18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0
              }}>3</div>
              <h3 style={{ margin: 0, fontSize: '0.93rem', fontWeight: 800, color: '#0f172a' }}>
                Merchant Interest Status <span style={{ color: '#ef4444' }}>*</span>
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* YES */}
              <button
                type="button"
                onClick={() => { setInterestStatus('YES'); setFieldErrors(p => ({ ...p, interestStatus: '' })); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px 10px', borderRadius: 12,
                  border: `2px solid ${interestStatus === 'YES' ? '#16a34a' : '#e2e8f0'}`,
                  background: interestStatus === 'YES' ? '#f0fdf4' : '#ffffff',
                  fontSize: '0.88rem', fontWeight: 800,
                  color: interestStatus === 'YES' ? '#16a34a' : '#475569',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <ThumbsUp size={18} />
                YES (Interested)
              </button>

              {/* NO */}
              <button
                type="button"
                onClick={() => { setInterestStatus('NO'); setFieldErrors(p => ({ ...p, interestStatus: '' })); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px 10px', borderRadius: 12,
                  border: `2px solid ${interestStatus === 'NO' ? '#dc2626' : '#e2e8f0'}`,
                  background: interestStatus === 'NO' ? '#fef2f2' : '#ffffff',
                  fontSize: '0.88rem', fontWeight: 800,
                  color: interestStatus === 'NO' ? '#dc2626' : '#475569',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <ThumbsDown size={18} />
                NO (Not Interested)
              </button>
            </div>

            {fieldErrors.interestStatus && (
              <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '8px 0 0', fontWeight: 600 }}>
                {fieldErrors.interestStatus}
              </p>
            )}

            {interestStatus === 'NO' && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: '#fef3c7', border: '1px solid #fde68a',
                borderRadius: 8, fontSize: '0.78rem', color: '#92400e', fontWeight: 600
              }}>
                ⚠️ Selecting "Not Interested" will save the field visit without creating a vendor account.
              </div>
            )}

            {interestStatus === 'YES' && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: 8, fontSize: '0.78rem', color: '#15803d', fontWeight: 600
              }}>
                ✓ Selecting "Interested" will proceed to the full Vendor Onboarding form.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, padding: '16px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          background: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
              background: '#ffffff', color: '#475569',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploadingPhoto}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 22px', borderRadius: 10, border: 'none',
              background: submitting || uploadingPhoto
                ? '#94a3b8'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              fontSize: '0.85rem', fontWeight: 800,
              cursor: submitting || uploadingPhoto ? 'not-allowed' : 'pointer',
              boxShadow: submitting || uploadingPhoto ? 'none' : '0 4px 12px rgba(245,158,11,0.35)'
            }}
          >
            {submitting ? (
              <>
                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : interestStatus === 'NO' ? (
              'Save Visit'
            ) : (
              'Continue to Onboarding →'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default FieldShopVisitModal;
