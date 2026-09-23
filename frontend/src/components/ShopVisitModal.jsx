import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { shopVisitService, uploadService, vendorService } from '../services/api';
import VoiceRecorder from './VoiceRecorder';
import VendorForm from './VendorForm';
import {
  Store, Camera, Mic, ThumbsUp, ThumbsDown, ArrowRight,
  CheckCircle2, AlertCircle, X, ChevronLeft, Upload, MapPin, Tag
} from 'lucide-react';

const MAIN_CATEGORIES = [
  'Services',
  'Products',
  'Daily Needs',
  'Food',
  'Stay',
  'Travel',
  'Jobs'
];

const REASONS = [
  'Not interested in digital onboarding',
  'Already using competitor software',
  'High commission concern',
  'Owner not available / Decision pending',
  'Business permanently closing / Moving',
  'Other (specify below)'
];

const ShopVisitModal = ({ onClose, onVisitCreated }) => {
  const { user } = useAuth();

  // Mode: 'single_page' (Shop info, Photo, Interest) | 'vendor_onboarding' (5-step vendor form if YES)
  const [viewMode, setViewMode] = useState('single_page');

  // Visit Data
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('Products');
  const [shopPhoto, setShopPhoto] = useState('');
  const [shopPhotoPreview, setShopPhotoPreview] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const [interestedStatus, setInterestedStatus] = useState(null); // 'YES' | 'NO'
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // States
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');

  const photoInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setShopPhotoPreview(localUrl);
    setShopPhoto(localUrl);
    setUploadingPhoto(true);
    setError('');

    try {
      const res = await uploadService.uploadDocument(file);
      if (res && res.success && res.file) {
        setShopPhoto(res.file.url);
      }
    } catch (err) {
      console.warn('Photo upload server warning (using preview):', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateCommonFields = () => {
    if (!shopName || !shopName.trim()) {
      setError('Step 1: Shop Name / Merchant Title is mandatory.');
      return false;
    }
    if (!shopPhoto && !shopPhotoPreview) {
      setError('Step 2: Shop Storefront Photo is mandatory. Please capture or upload a photo.');
      return false;
    }
    if (!interestedStatus) {
      setError('Step 3: Interest Status (YES or NO) is mandatory.');
      return false;
    }
    setError('');
    return true;
  };

  const handleCloseReasonSubmit = async () => {
    if (!validateCommonFields()) return;

    if (!voiceNote) {
      setError('Voice Note is mandatory. Please record or upload an audio note explaining the reason.');
      return;
    }

    if (reason === 'Other (specify below)' && !customReason.trim()) {
      setError('Please specify the reason for not interested.');
      return;
    }

    const finalReason = reason === 'Other (specify below)'
      ? (customReason.trim() || 'Other reason')
      : reason;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        shopName: shopName.trim(),
        category: category || 'Products',
        shopPhoto: shopPhoto || shopPhotoPreview || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
        voiceNote: voiceNote || 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAA=',
        interestedStatus: 'NO',
        notInterestedReason: finalReason,
        pincodeCode: user?.pincode || user?.pincodeCode || null,
        pincodeId: user?.pincodeId || null,
        divisionId: user?.divisionId || null,
        districtId: user?.districtId || null,
        stateId: user?.stateId || null
      };

      const res = await shopVisitService.createShopVisit(payload);
      if (res && res.success) {
        if (onVisitCreated) onVisitCreated(res.data);
        onClose();
      } else {
        setError(res?.message || 'Failed to submit visit record');
      }
    } catch (err) {
      console.error('Failed to submit non-interested visit:', err);
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToVendorOnboard = () => {
    if (!validateCommonFields()) return;
    setViewMode('vendor_onboarding');
  };

  const handleVendorOnboardSubmit = async (vendorFormData) => {
    setSubmitting(true);
    setError('');
    try {
      // 1. Create Vendor
      const vendorRes = await vendorService.createVendor({
        ...vendorFormData,
        businessName: vendorFormData.businessName || shopName,
        category: vendorFormData.category || category
      });

      if (vendorRes && vendorRes.success) {
        const vendorId = vendorRes.data?._id || vendorRes.data?.id;

        // 2. Record Shop Visit with YES and link vendorId
        const visitPayload = {
          shopName: shopName.trim() || vendorFormData.businessName,
          category: category || vendorFormData.category || 'Products',
          shopPhoto: (shopPhoto && !shopPhoto.startsWith('blob:')) ? shopPhoto : (vendorFormData.documents?.[0]?.url || shopPhoto || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500'),
          voiceNote: voiceNote || null,
          interestedStatus: 'YES',
          vendorId,
          pincodeCode: user?.pincode || user?.pincodeCode || null,
          pincodeId: user?.pincodeId || null,
          divisionId: user?.divisionId || null,
          districtId: user?.districtId || null,
          stateId: user?.stateId || null
        };

        const visitRes = await shopVisitService.createShopVisit(visitPayload);
        if (visitRes && visitRes.success && onVisitCreated) {
          onVisitCreated(visitRes.data);
        }
        onClose();
      } else {
        setError(vendorRes?.message || 'Vendor onboarding failed');
      }
    } catch (err) {
      console.error('Failed vendor onboarding from visit:', err);
      setError(err.message || 'Vendor registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)'
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

      {/* Modal Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: viewMode === 'vendor_onboarding' ? 740 : 660,
        maxHeight: 'min(92vh, 840px)',
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1,
        transition: 'max-width 0.3s ease'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #f1f5f9',
          background: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.25)'
            }}>
              <Store size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                {viewMode === 'vendor_onboarding' ? 'Vendor Onboarding (Interested Merchant)' : 'Field Shop Visit'}
              </h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>
                {viewMode === 'vendor_onboarding'
                  ? `Completing full onboarding registration for ${shopName}`
                  : 'Shop Information, Business Category, Storefront Photo & Interest Status'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {viewMode === 'single_page' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* STEP 1: Shop Name & Category */}
              <div style={{
                padding: '16px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#0f172a'
                }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: '#f59e0b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>1</div>
                  <span>Shop Details &amp; Business Category <span style={{ color: '#ef4444' }}>*</span></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {/* Shop Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Shop Name / Business Title
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sri Lakshmi Supermarket"
                      value={shopName}
                      onChange={(e) => {
                        setShopName(e.target.value);
                        setError('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '0.88rem',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* 7 Main Categories Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Main Business Category
                    </label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setError('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '0.88rem',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      {MAIN_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 2: Shop Photo */}
              <div style={{
                padding: '16px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#0f172a'
                }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: '#f59e0b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>2</div>
                  <span>Shop Storefront Photo <span style={{ color: '#ef4444' }}>*</span></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {shopPhotoPreview ? (
                    <div style={{ position: 'relative', width: 96, height: 96, borderRadius: 12, overflow: 'hidden', border: '2px solid #f59e0b' }}>
                      <img src={shopPhotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => {
                          setShopPhoto('');
                          setShopPhotoPreview('');
                        }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12
                        }}
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 12,
                        border: '2px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        background: '#ffffff',
                        color: '#64748b'
                      }}
                    >
                      <Camera size={22} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: 10, fontWeight: 700 }}>Add Photo</span>
                    </div>
                  )}

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                  />

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: uploadingPhoto ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Upload size={14} />
                      <span>{uploadingPhoto ? 'Uploading Photo...' : (shopPhoto || shopPhotoPreview ? 'Change Photo' : 'Capture or Upload Store Photo')}</span>
                    </button>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Clear storefront image showing the board or entrance.
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 3: Interest Status */}
              <div style={{
                padding: '16px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#0f172a'
                }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: '#f59e0b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>3</div>
                  <span>Merchant Interest Status <span style={{ color: '#ef4444' }}>*</span></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* YES Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setInterestedStatus('YES');
                      setError('');
                    }}
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      border: interestedStatus === 'YES' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      background: interestedStatus === 'YES' ? '#ecfdf5' : '#ffffff',
                      color: interestedStatus === 'YES' ? '#047857' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      boxShadow: interestedStatus === 'YES' ? '0 4px 12px rgba(16, 185, 129, 0.18)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    <ThumbsUp size={18} />
                    <span>YES (Interested)</span>
                  </button>

                  {/* NO Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setInterestedStatus('NO');
                      setError('');
                    }}
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      border: interestedStatus === 'NO' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: interestedStatus === 'NO' ? '#fef2f2' : '#ffffff',
                      color: interestedStatus === 'NO' ? '#b91c1c' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      boxShadow: interestedStatus === 'NO' ? '0 4px 12px rgba(239, 68, 68, 0.18)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    <ThumbsDown size={18} />
                    <span>NO (Not Interested)</span>
                  </button>
                </div>

                {/* DYNAMIC SECTION BASED ON INTEREST */}
                {interestedStatus === 'YES' && (
                  <div style={{
                    marginTop: 16,
                    padding: '14px',
                    borderRadius: 10,
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0'
                  }}>
                    <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.88rem' }}>
                      Great! Ready to Onboard Merchant.
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#065f46', margin: '4px 0 12px' }}>
                      Click below to proceed to the 5-step Vendor Registration form.
                    </p>
                    <button
                      type="button"
                      onClick={handleProceedToVendorOnboard}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 8,
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span>Proceed to 5-Step Onboarding Form</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}

                {interestedStatus === 'NO' && (
                  <div style={{
                    marginTop: 16,
                    padding: '14px',
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>
                        Select Reason for Not Interested <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        className="form-select"
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setError('');
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          fontSize: '0.84rem',
                          borderRadius: 8,
                          border: '1px solid #fca5a5',
                          background: '#ffffff'
                        }}
                      >
                        {REASONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    {reason === 'Other (specify below)' && (
                      <div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Please type the specific reason..."
                          value={customReason}
                          onChange={(e) => {
                            setCustomReason(e.target.value);
                            setError('');
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            fontSize: '0.84rem',
                            borderRadius: 8,
                            border: '1px solid #fca5a5',
                            background: '#ffffff'
                          }}
                        />
                      </div>
                    )}

                    {/* Mandatory Voice Note */}
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>
                        Mandatory Audio Voice Note <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <VoiceRecorder
                        onAudioRecorded={(url) => {
                          setVoiceNote(url);
                          setError('');
                        }}
                        onVoiceNoteUploaded={(url) => {
                          setVoiceNote(url);
                          setError('');
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleCloseReasonSubmit}
                      style={{
                        marginTop: 6,
                        padding: '12px 18px',
                        borderRadius: 10,
                        background: submitting ? '#94a3b8' : '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {submitting ? 'Saving Visit Record...' : 'Submit & Close Visit Record'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Mode 2: 5-step vendor form */
            <div>
              <button
                type="button"
                onClick={() => setViewMode('single_page')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  color: '#f59e0b',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: 12,
                  padding: 0
                }}
              >
                <ChevronLeft size={14} /> Back to Shop Details
              </button>

              <VendorForm
                initialData={{
                  businessName: shopName,
                  category,
                  logoPreview: shopPhotoPreview
                }}
                onSubmit={handleVendorOnboardSubmit}
                onCancel={() => setViewMode('single_page')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopVisitModal;
