/**
 * FieldShopVisitModal.jsx
 *
 * Step 0 of the Manager Vendor Onboarding workflow.
 * Captures: Shop Name, Business Category, Storefront Photo, Merchant Interest Status.
 *
 * If Interested (YES) → calls onProceedToOnboarding(visitId, prefillData)
 * If Not Interested (NO) → saves visit (with reason + audio), closes modal.
 *
 * Uses the canonical /api/shop-visits endpoint (shopVisitService.createShopVisit).
 * The /api/manager-onboarding/field-visit route now proxies to the same handler.
 */

import React, { useState, useRef } from 'react';
import {
  Camera, Upload, ThumbsUp, ThumbsDown, X, Store,
  CheckCircle2, AlertCircle, Loader, Mic
} from 'lucide-react';
import { shopVisitService, uploadService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VoiceRecorder from './VoiceRecorder';

const BUSINESS_CATEGORIES = [
  'Products',
  'Services',
  'Daily Needs',
  'Food',
  'Stay',
  'Travel',
  'Jobs',
];

const NOT_INTERESTED_REASONS = [
  'Not interested in digital onboarding',
  'Already using competitor software',
  'High commission concern',
  'Owner not available / Decision pending',
  'Business permanently closing / Moving',
  'Other (specify below)',
];

const FieldShopVisitModal = ({ onClose, onProceedToOnboarding }) => {
  const { user } = useAuth();

  // ── Form fields ────────────────────────────────────────
  const [shopName, setShopName]               = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [storefrontFile, setStorefrontFile]   = useState(null);
  const [storefrontPreview, setStorefrontPreview] = useState(null);
  const [storefrontUrl, setStorefrontUrl]     = useState('');
  const [interestStatus, setInterestStatus]   = useState(''); // 'YES' | 'NO'

  // NOT-interested sub-fields
  const [notInterestedReason, setNotInterestedReason] = useState(NOT_INTERESTED_REASONS[0]);
  const [otherReason, setOtherReason]         = useState('');
  const [audioVoiceNote, setAudioVoiceNote]   = useState('');

  // ── UI state ────────────────────────────────────────────
  const [uploadingPhoto, setUploadingPhoto]   = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const [fieldErrors, setFieldErrors]         = useState({});
  const [success, setSuccess]                 = useState('');

  const fileInputRef = useRef(null);

  const isOtherReason = notInterestedReason === 'Other (specify below)';

  // ── Photo upload ────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be smaller than 5 MB.');
      return;
    }

    setError('');
    setStorefrontFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setStorefrontPreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    try {
      const res = await uploadService.uploadDocument(file);
      if (res.success && res.file?.url) {
        setStorefrontUrl(res.file.url);
        setFieldErrors(prev => ({ ...prev, storefrontPhoto: '' }));
      } else {
        setError('Unable to upload storefront photo. Please try again.');
        setStorefrontFile(null);
        setStorefrontPreview(null);
      }
    } catch (err) {
      setError('Unable to upload storefront photo: ' + (err.message || 'Server error.'));
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

  // ── Validation ──────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!shopName.trim())       errs.shopName = 'Shop name is required.';
    if (!businessCategory)      errs.businessCategory = 'Please select a business category.';
    if (!storefrontUrl)         errs.storefrontPhoto = 'Storefront photo is required.';
    if (!interestStatus)        errs.interestStatus = 'Please select merchant interest status.';

    if (interestStatus === 'NO') {
      if (!notInterestedReason) errs.notInterestedReason = 'Please select a reason.';
      if (isOtherReason && !otherReason.trim()) {
        errs.otherReason = 'Please specify the reason.';
      }
      if (isOtherReason && !audioVoiceNote) {
        errs.audioVoiceNote = 'Audio voice note is mandatory when selecting "Other".';
      }
    }

    return errs;
  };

  // ── Submit ──────────────────────────────────────────────
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
        shopName:           shopName.trim(),
        category:           businessCategory,
        businessCategory:   businessCategory,
        shopPhoto:          storefrontUrl,
        storefrontPhoto:    storefrontUrl,
        interestedStatus:   interestStatus,
        interestStatus:     interestStatus,
        notInterestedReason: interestStatus === 'NO'
          ? (isOtherReason ? 'Other (specify below)' : notInterestedReason)
          : 'Interested in Onboarding',
        otherReason:    isOtherReason ? otherReason.trim() : null,
        voiceNote:      interestStatus === 'NO' ? (audioVoiceNote || null) : null,
        audioVoiceNote: interestStatus === 'NO' ? (audioVoiceNote || null) : null,
        stateId:    user?.stateId    || null,
        districtId: user?.districtId || null,
        divisionId: user?.divisionId || null,
        pincodeId:  user?.pincodeId  || null,
        pincodeCode: user?.scope?.pincodeCode || user?.pincode || null,
      };

      // Use the canonical shop-visits endpoint
      const res = await shopVisitService.createShopVisit(payload);

      if (!res.success) {
        setError(res.message || 'Failed to save field visit.');
        return;
      }

      if (interestStatus === 'NO') {
        setSuccess('Shop visit recorded successfully. No vendor account will be created.');
        setTimeout(() => onClose(), 2800);
        return;
      }

      // Merchant is interested — proceed to vendor onboarding
      onProceedToOnboarding(res.data._id || res.data.id, {
        shopName:        shopName.trim(),
        businessCategory,
        storefrontPhoto: storefrontUrl,
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
    transition: 'border-color 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px',
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
        maxWidth: '560px',
        maxHeight: '94vh',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 20px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Store size={22} style={{ color: '#ffffff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              Field Shop Visit
            </h2>
            <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>
              Shop Details · Business Category · Storefront Photo · Interest Status
            </p>
          </div>
          <button
            onClick={!submitting ? onClose : undefined}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Alerts */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 10,
              color: '#b91c1c', fontSize: '0.83rem', fontWeight: 600, marginBottom: 16,
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
              color: '#15803d', fontSize: '0.83rem', fontWeight: 600, marginBottom: 16,
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{success}</span>
            </div>
          )}

          {/* ── Section 1: Shop Details ── */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0,
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
                  style={{ ...inputStyle(!!fieldErrors.businessCategory), background: '#ffffff' }}
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
            background: '#f8fafc',
            border: `1px solid ${fieldErrors.storefrontPhoto ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0,
              }}>2</div>
              <h3 style={{ margin: 0, fontSize: '0.93rem', fontWeight: 800, color: '#0f172a' }}>
                Shop Storefront Photo <span style={{ color: '#ef4444' }}>*</span>
              </h3>
            </div>

            {storefrontPreview ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 100, height: 80, borderRadius: 10, overflow: 'hidden',
                  border: '2px solid #e2e8f0', flexShrink: 0, position: 'relative',
                }}>
                  <img src={storefrontPreview} alt="Storefront Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {uploadingPhoto && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >Replace</button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={uploadingPhoto}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                        background: '#ffffff', color: '#64748b',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >Remove</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 90, height: 76, borderRadius: 10,
                    border: '2px dashed #cbd5e1',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 4, cursor: 'pointer',
                    background: '#f1f5f9', flexShrink: 0,
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
                      cursor: 'pointer', marginBottom: 6,
                    }}
                  >
                    <Upload size={15} /> Capture or Upload Store Photo
                  </button>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                    Clear storefront image showing the board or entrance. JPG, PNG, WEBP up to 5 MB.
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
            background: '#f8fafc',
            border: `1px solid ${fieldErrors.interestStatus ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0,
              }}>3</div>
              <h3 style={{ margin: 0, fontSize: '0.93rem', fontWeight: 800, color: '#0f172a' }}>
                Merchant Interest Status <span style={{ color: '#ef4444' }}>*</span>
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <ThumbsUp size={18} /> YES (Interested)
              </button>

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
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <ThumbsDown size={18} /> NO (Not Interested)
              </button>
            </div>

            {fieldErrors.interestStatus && (
              <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '8px 0 0', fontWeight: 600 }}>
                {fieldErrors.interestStatus}
              </p>
            )}

            {/* YES message */}
            {interestStatus === 'YES' && (
              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: 8, fontSize: '0.78rem', color: '#15803d', fontWeight: 600,
              }}>
                ✓ Selecting "Interested" will proceed to the full Vendor Onboarding form.
              </div>
            )}

            {/* NO — reason section */}
            {interestStatus === 'NO' && (
              <div style={{
                marginTop: 14, padding: '14px 16px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                {/* Reason Dropdown */}
                <div>
                  <label style={{
                    display: 'block', fontSize: '0.78rem', fontWeight: 700,
                    color: '#7f1d1d', marginBottom: 6,
                  }}>
                    Select Reason for Not Interested <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={notInterestedReason}
                    onChange={e => {
                      setNotInterestedReason(e.target.value);
                      setFieldErrors(p => ({ ...p, notInterestedReason: '', otherReason: '', audioVoiceNote: '' }));
                    }}
                    style={{
                      width: '100%', padding: '9px 12px', fontSize: '0.85rem',
                      borderRadius: 8, border: `1px solid ${fieldErrors.notInterestedReason ? '#ef4444' : '#fca5a5'}`,
                      background: '#ffffff', color: '#0f172a',
                    }}
                  >
                    {NOT_INTERESTED_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {fieldErrors.notInterestedReason && (
                    <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '4px 0 0', fontWeight: 600 }}>
                      {fieldErrors.notInterestedReason}
                    </p>
                  )}
                </div>

                {/* "Other" text input */}
                {isOtherReason && (
                  <div>
                    <label style={{
                      display: 'block', fontSize: '0.78rem', fontWeight: 700,
                      color: '#7f1d1d', marginBottom: 6,
                    }}>
                      Specify Reason <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Please specify reason..."
                      value={otherReason}
                      onChange={e => {
                        setOtherReason(e.target.value);
                        setFieldErrors(p => ({ ...p, otherReason: '' }));
                      }}
                      style={{
                        width: '100%', padding: '9px 12px', fontSize: '0.85rem',
                        borderRadius: 8, resize: 'vertical',
                        border: `1px solid ${fieldErrors.otherReason ? '#ef4444' : '#fca5a5'}`,
                        background: '#ffffff', color: '#0f172a', boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                    {fieldErrors.otherReason && (
                      <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '4px 0 0', fontWeight: 600 }}>
                        {fieldErrors.otherReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Audio Voice Note — mandatory for "Other" */}
                {isOtherReason && (
                  <div>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.78rem', fontWeight: 700,
                      color: '#7f1d1d', marginBottom: 8,
                    }}>
                      <Mic size={14} />
                      Mandatory Audio Voice Note <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <VoiceRecorder
                      onAudioRecorded={url => {
                        setAudioVoiceNote(url || '');
                        setFieldErrors(p => ({ ...p, audioVoiceNote: '' }));
                      }}
                      onVoiceNoteUploaded={url => {
                        setAudioVoiceNote(url || '');
                        setFieldErrors(p => ({ ...p, audioVoiceNote: '' }));
                      }}
                    />
                    {fieldErrors.audioVoiceNote && (
                      <p style={{ color: '#ef4444', fontSize: '0.73rem', margin: '8px 0 0', fontWeight: 600 }}>
                        {fieldErrors.audioVoiceNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, padding: '16px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          background: '#f8fafc',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
              background: '#ffffff', color: '#475569',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
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
                : interestStatus === 'NO'
                  ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              fontSize: '0.85rem', fontWeight: 800,
              cursor: submitting || uploadingPhoto ? 'not-allowed' : 'pointer',
              boxShadow: submitting || uploadingPhoto ? 'none' : '0 4px 12px rgba(245,158,11,0.35)',
            }}
          >
            {submitting ? (
              <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
            ) : interestStatus === 'NO' ? (
              'Submit & Close Visit Record'
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
