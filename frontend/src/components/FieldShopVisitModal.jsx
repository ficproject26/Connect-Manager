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

import React, { useState, useRef, useEffect } from 'react';
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
  const [notInterestedReason, setNotInterestedReason] = useState('');
  const [otherReason, setOtherReason]         = useState('');
  const [audioVoiceNote, setAudioVoiceNote]   = useState('');

  // ── UI state ────────────────────────────────────────────
  const [uploadingPhoto, setUploadingPhoto]   = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const [fieldErrors, setFieldErrors]         = useState({});
  const [success, setSuccess]                 = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const isOtherReason = notInterestedReason === 'Other (specify below)';

  // Stop camera media tracks helper
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // ── Unified Photo Processing (Upload + Live Snapshot) ──
  const processFile = async (file) => {
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
      const uploadedUrl = res?.file?.url || res?.url || res?.data?.url || res?.filePath;
      if (res?.success && uploadedUrl) {
        setStorefrontUrl(uploadedUrl);
        setFieldErrors(prev => ({ ...prev, storefrontPhoto: '' }));
        setError('');
      } else {
        const base64Url = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.readAsDataURL(file);
        });
        if (base64Url) {
          setStorefrontUrl(base64Url);
          setStorefrontPreview(base64Url);
          setFieldErrors(prev => ({ ...prev, storefrontPhoto: '' }));
          setError('');
        } else {
          setError(res?.message || 'Unable to upload storefront photo. Please try again.');
          setStorefrontFile(null);
          setStorefrontPreview(null);
        }
      }
    } catch (err) {
      console.warn('Network upload failed, attempting fallback to base64 preview:', err);
      try {
        const base64Url = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.readAsDataURL(file);
        });
        if (base64Url) {
          setStorefrontUrl(base64Url);
          setStorefrontPreview(base64Url);
          setFieldErrors(prev => ({ ...prev, storefrontPhoto: '' }));
          setError('');
          return;
        }
      } catch (_) {}
      setError('Unable to upload storefront photo: ' + (err.message || 'Server error.'));
      setStorefrontFile(null);
      setStorefrontPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCapturePhotoClick = async () => {
    setError('');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

    // On mobile devices, trigger native camera capture input
    if (isMobile) {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
        return;
      }
    }

    // On desktop, open live camera viewfinder if supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setCameraLoading(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setCameraLoading(false);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn('Camera video play failed:', e));
          }
        }, 50);
      } catch (err) {
        console.warn('Camera capture error on desktop:', err);
        stopCameraStream();
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission was denied. Please allow camera access in your browser or use "Upload Photo".');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera device detected on this system. Please use "Upload Photo" instead.');
        } else {
          setError('Camera could not be started: ' + (err.message || 'Device unsupported') + '. Please use "Upload Photo".');
        }
      }
    } else {
      // Fallback if mediaDevices is not supported
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `storefront_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCameraStream();
        processFile(file);
      } else {
        setError('Could not capture frame from camera.');
      }
    }, 'image/jpeg', 0.92);
  };

  const handleUploadPhotoClick = () => {
    setError('');
    stopCameraStream();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const removePhoto = () => {
    stopCameraStream();
    setStorefrontFile(null);
    setStorefrontPreview(null);
    setStorefrontUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // ── Validation ──────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!shopName.trim())       errs.shopName = 'Shop name is required.';
    if (!businessCategory)      errs.businessCategory = 'Please select a business category.';
    if (!storefrontUrl)         errs.storefrontPhoto = 'Storefront photo is required.';
    if (!interestStatus)        errs.interestStatus = 'Please select merchant interest status.';

    if (interestStatus === 'NO') {
      const isOther = notInterestedReason === 'Other (specify below)';
      const hasPredefinedReason = notInterestedReason && notInterestedReason.trim().length > 0 && !isOther;
      const hasOtherReason = isOther && otherReason?.trim().length > 0;
      const hasWrittenReason = hasPredefinedReason || hasOtherReason;
      const hasAudioVoiceNote = !!audioVoiceNote;

      const canSubmit = hasWrittenReason || hasAudioVoiceNote;

      if (!canSubmit) {
        errs.notInterestedReason = 'Please provide a reason or a voice note.';
        if (isOther && !hasAudioVoiceNote) {
          errs.otherReason = 'Please specify reason or provide a voice note.';
        }
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
          ? (isOtherReason && otherReason.trim() ? otherReason.trim() : (notInterestedReason || (audioVoiceNote ? 'Not Interested (Audio Provided)' : 'Not specified')))
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

            <div className="responsive-grid-2" style={{ gap: '12px' }}>
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

            {/* Desktop Live Camera Viewfinder */}
            {isCameraActive ? (
              <div style={{
                background: '#0f172a',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 440, borderRadius: 8, overflow: 'hidden' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      maxHeight: '260px',
                      objectFit: 'cover',
                      display: 'block',
                      background: '#000000',
                      borderRadius: 8,
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }}></span>
                    Live Camera
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={takeSnapshot}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none', color: '#ffffff',
                      fontSize: '0.85rem', fontWeight: 800,
                      cursor: 'pointer', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    <Camera size={16} /> Snap Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 16px', borderRadius: 10,
                      background: '#334155', border: 'none', color: '#f8fafc',
                      fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <X size={16} /> Cancel
                  </button>
                </div>
              </div>
            ) : storefrontPreview ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 90, height: 76, borderRadius: 10, overflow: 'hidden',
                  border: '2px solid #e2e8f0', flexShrink: 0, position: 'relative',
                  background: '#000',
                }}>
                  <img
                    src={storefrontPreview}
                    alt="Storefront Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {uploadingPhoto && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: '#ffffff' }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 3px', fontSize: '0.82rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={14} /> Storefront Photo Selected
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#64748b' }}>
                    {storefrontFile?.name || 'Photo captured'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleCapturePhotoClick}
                      disabled={uploadingPhoto || cameraLoading}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #d97706',
                        background: '#fffbeb', color: '#d97706',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <Camera size={13} /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadPhotoClick}
                      disabled={uploadingPhoto}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                        background: '#ffffff', color: '#334155',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <Upload size={13} /> Upload New
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={uploadingPhoto}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                        background: '#ffffff', color: '#ef4444',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div
                    onClick={handleCapturePhotoClick}
                    title="Click to capture photo using camera"
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {/* 1. Capture Photo Button */}
                      <button
                        type="button"
                        onClick={handleCapturePhotoClick}
                        disabled={cameraLoading}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '9px 15px', borderRadius: 10,
                          border: '1.5px solid #d97706', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                          fontSize: '0.82rem', fontWeight: 800, color: '#b45309',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(217, 119, 6, 0.12)'
                        }}
                      >
                        {cameraLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={15} />}
                        Capture Photo
                      </button>

                      {/* 2. Upload Photo Button */}
                      <button
                        type="button"
                        onClick={handleUploadPhotoClick}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '9px 15px', borderRadius: 10,
                          border: '1.5px solid #cbd5e1', background: '#ffffff',
                          fontSize: '0.82rem', fontWeight: 700, color: '#334155',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                        }}
                      >
                        <Upload size={15} /> Upload Photo
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                      Clear storefront image showing the board or entrance. JPG, PNG, WEBP up to 5 MB.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Standard file picker input for Upload option */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {/* Dedicated camera input for mobile direct capture */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              capture="environment"
              onChange={handleFileInputChange}
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
                    <option value="">-- Select a reason (or leave blank if providing voice note) --</option>
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
                      Specify Reason {!audioVoiceNote && <span style={{ color: '#ef4444' }}>*</span>}
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

                {/* Audio Voice Note — Optional for Not Interested */}
                <div>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: '0.78rem', fontWeight: 700,
                    color: '#7f1d1d', marginBottom: 4,
                  }}>
                    <Mic size={14} />
                    Audio Voice Note
                  </label>
                  <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: '#991b1b' }}>
                    Optional — add a voice note if additional explanation is needed.
                  </p>
                  <VoiceRecorder
                    onAudioRecorded={url => {
                      setAudioVoiceNote(url || '');
                      setFieldErrors(p => ({ ...p, notInterestedReason: '', otherReason: '', audioVoiceNote: '' }));
                    }}
                    onVoiceNoteUploaded={url => {
                      setAudioVoiceNote(url || '');
                      setFieldErrors(p => ({ ...p, notInterestedReason: '', otherReason: '', audioVoiceNote: '' }));
                    }}
                  />
                </div>
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
