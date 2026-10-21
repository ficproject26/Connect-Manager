import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { locationService, uploadService, vendorService } from '../services/api';
import {
  Lock, Upload, CheckCircle2, AlertCircle, Store, User,
  FileText, CreditCard, CheckCircle,
  ChevronRight, ChevronLeft, Eye, EyeOff, X,
  Camera, BadgeCheck, Image as ImageIcon, Clock, Sparkles, Trash2,
  ShieldCheck, Smartphone, Send, RefreshCw
} from 'lucide-react';

const CATEGORIES = [
  'Services', 'Products', 'Daily Needs', 'Food', 'Stay', 'Travel', 'Jobs'
];

const STEPS = [
  { id: 1, label: 'Business',  icon: Store },
  { id: 2, label: 'Owner',     icon: User },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Bank',      icon: CreditCard },
  { id: 5, label: 'Review',    icon: BadgeCheck },
];

import {
  formatName,
  validateName,
  validateEmail,
  cleanMobile,
  validateMobile,
  validatePassword,
  validatePasswordMatch,
  cleanPan,
  validatePan,
  cleanAadhaar,
  validateAadhaar,
  maskAadhaar,
  cleanAccountNumber,
  validateAccountNumber,
  maskAccountNumber,
  cleanIfsc,
  validateIfsc
} from '../utils/validation';

const phoneOk     = v => !validateMobile(v, true);
const panOk       = v => !validatePan(v, true);
const aadhaarOk   = v => !validateAadhaar(v, true);
const ifscOk      = v => !validateIfsc(v, true);
function StepBar({ current }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: '14px 18px',
      background: '#ffffff',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      marginBottom: 24
    }}>
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.id}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              minWidth: 54
            }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : active
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : '#f1f5f9',
                border: done || active ? 'none' : '1.5px solid #cbd5e1',
                boxShadow: active
                  ? '0 0 0 4px rgba(245, 158, 11, 0.22), 0 2px 6px rgba(245, 158, 11, 0.35)'
                  : done
                  ? '0 2px 6px rgba(16, 185, 129, 0.3)'
                  : 'none',
                transition: 'all 0.25s ease'
              }}>
                {done ? (
                  <CheckCircle size={18} color="#ffffff" strokeWidth={2.5} />
                ) : (
                  <Icon
                    size={17}
                    color={active ? '#ffffff' : '#64748b'}
                    strokeWidth={active ? 2.3 : 2}
                  />
                )}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: active ? 800 : done ? 700 : 600,
                marginTop: 6,
                whiteSpace: 'nowrap',
                color: active ? '#b45309' : done ? '#059669' : '#64748b'
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 3,
                margin: '0 8px',
                marginBottom: 18,
                background: done ? '#10b981' : '#e2e8f0',
                borderRadius: 2,
                transition: 'background 0.3s ease'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">
        {label}{required && <span style={{ color:'#ef4444',marginLeft:2 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ marginTop:4,fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:4 }}>
          <AlertCircle size={11}/>{error}
        </p>
      )}
    </div>
  );
}

const RRow = ({ label, value }) => (
  <div style={{ marginBottom:6 }}>
    <div style={{ fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',fontWeight:600 }}>{label}</div>
    <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)',marginTop:2,wordBreak:'break-all' }}>{value||'—'}</div>
  </div>
);

const RSection = ({ title, icon: Icon, children }) => (
  <div style={{ borderRadius:10,border:'1px solid var(--border)',overflow:'hidden',marginBottom:10 }}>
    <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)' }}>
      <Icon size={13} color="var(--primary)"/>
      <span style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)' }}>{title}</span>
    </div>
    <div className="responsive-grid-2" style={{ padding:'10px 14px', gap:'6px 16px' }}>{children}</div>
  </div>
);


const TIME_SLOT_OPTIONS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM', '12:00 AM'
];

const PRESET_TIME_SLOTS = [
  { label: 'General Retail', slot: '09:00 AM - 09:00 PM' },
  { label: 'Commercial / Mall', slot: '10:00 AM - 10:00 PM' },
  { label: 'Daily Needs / Grocery', slot: '08:00 AM - 08:00 PM' },
  { label: 'Morning Shift', slot: '06:00 AM - 02:00 PM' },
  { label: 'Food & Dining', slot: '11:00 AM - 11:00 PM' },
  { label: 'Open 24/7', slot: 'Open 24/7' },
];
const VendorForm = ({ initialData, prefill, onSubmit, isEditing = false, onCancel }) => {
  const { user } = useAuth();

  const normRole = (r) => {
    const s = String(r || '').toLowerCase().replace(/[\s-]/g, '_');
    if (s.includes('state')) return 'state_manager';
    if (s.includes('district')) return 'district_manager';
    if (s.includes('division')) return 'division_manager';
    if (s.includes('pincode') || s.includes('pin_code')) return 'pincode_manager';
    return s;
  };

  const role = normRole(user?.role);
  const isStateManager = role === 'state_manager';
  const isDistrictManager = role === 'district_manager';
  const isDivisionManager = role === 'division_manager';
  const isPincodeManager = role === 'pincode_manager';

  // Role-Based Field Permissions:
  // State Manager: State locked; District, Division, Pincode enabled
  // District Manager: State, District locked; Division, Pincode enabled
  // Division Manager: State, District, Division locked; Pincode enabled
  // Pincode Manager: State, District, Division, Pincode all locked
  const isStateLocked = true;
  const isDistrictLocked = isDistrictManager || isDivisionManager || isPincodeManager;
  const isDivisionLocked = isDivisionManager || isPincodeManager;
  const isPincodeLocked = isPincodeManager;

  const userStateId = user?.stateId || user?.scope?.stateId || user?.territory?.stateId || user?.regionId || user?.scope?.regionId || '';
  const userStateName = user?.stateName || user?.state || user?.scope?.stateName || user?.territory?.state || user?.scope?.regionName || '';

  const userDistrictId = user?.districtId || user?.scope?.districtId || user?.territory?.districtId || '';
  const userDistrictName = user?.districtName || user?.district || user?.scope?.districtName || user?.territory?.district || '';

  const userDivisionId = user?.divisionId || user?.scope?.divisionId || user?.territory?.divisionId || '';
  const userDivisionName = user?.divisionName || user?.division || user?.scope?.divisionName || user?.territory?.division || '';

  const userPincodeId = user?.pincodeId || user?.scope?.pincodeId || user?.territory?.pincodeId || '';
  const userPincodeCode = user?.pincodeCode || user?.pincode || user?.scope?.pincodeCode || user?.territory?.pincode || '';
  const userPincodeArea = user?.pincodeArea || user?.scope?.pincodeArea || user?.area || user?.territory?.pincodeArea || '';

  // Validate manager territory scope completeness
  let territoryConfigError = '';
  if (isStateManager && !userStateId && !userStateName) {
    territoryConfigError = 'Manager account does not have an assigned State. Cannot onboard vendor without assigned state.';
  } else if (isDistrictManager && (!userDistrictId && !userDistrictName)) {
    territoryConfigError = 'Manager account does not have an assigned District. Cannot onboard vendor without assigned district.';
  } else if (isDivisionManager && (!userDivisionId && !userDivisionName)) {
    territoryConfigError = 'Manager account does not have an assigned Division. Cannot onboard vendor without assigned division.';
  } else if (isPincodeManager && (!userPincodeId && !userPincodeCode)) {
    territoryConfigError = 'Manager account does not have an assigned Pincode. Cannot onboard vendor without assigned pincode.';
  }

  const getBlank = () => {
    const prefillData = prefill || {};
    const initData = initialData || {};
    const effectivePrefill = { ...prefillData, ...initData };
    const prefillShop = effectivePrefill.shopName || effectivePrefill.businessName || '';
    const prefillCat = effectivePrefill.businessCategory || effectivePrefill.category || CATEGORIES[0];
    const prefillDocs = effectivePrefill.storefrontPhoto
      ? [{ url: effectivePrefill.storefrontPhoto, name: 'Storefront On-Ground Photo.jpg', type: 'image/jpeg' }]
      : (Array.isArray(effectivePrefill.documents) ? effectivePrefill.documents : []);

    const initialBusinessImages = Array.isArray(effectivePrefill.businessImages)
      ? effectivePrefill.businessImages
      : (Array.isArray(initialData?.businessImages) ? initialData.businessImages : []);

    const initialBusinessPreviews = initialBusinessImages
      .map(img => typeof img === 'string' ? img : img.url || '')
      .filter(Boolean);

    return {
      businessName: prefillShop,
      logo: effectivePrefill.logo || null,
      logoPreview: (typeof effectivePrefill.logo === 'string' ? effectivePrefill.logo : effectivePrefill.logo?.url) || null,
      category: prefillCat,
      mobile: effectivePrefill.mobile || effectivePrefill.phone || '',
      email: effectivePrefill.email || '',
      address: '',
      website: '',
      operatingHours: '09:00 AM - 09:00 PM',
      businessImages: initialBusinessImages,
      businessImagePreviews: initialBusinessPreviews,
      name: '',
      alternatePhone: '',
      agentName: '',
      coPartnerName: '',
      password: '',
      confirmPassword: '',
      panNumber: '',
      aadhaarNumber: '',
      companyRegNumber: '',
      gstStatus: 'Registered',
      msmeStatus: 'Not Registered',
      businessLicense: effectivePrefill.businessLicense || null,
      gstNumber: '',
      subCategory: '',
      description: '',
      documents: prefillDocs,
      accountHolderName: '',
      bankName: '',
      bankBranch: '',
      bankStreet: '',
      bankCity: '',
      accountNumber: '',
      ifsc: '',
      declaration: false,
      ...effectivePrefill,
      stateId: userStateId || effectivePrefill.stateId || '',
      ...(isDistrictLocked ? { districtId: userDistrictId } : {}),
      ...(isDivisionLocked ? { divisionId: userDivisionId } : {}),
      ...(isPincodeLocked ? { pincodeId: userPincodeId } : {})
    };
  };
  const [step, setStep] = useState(() => {
    if (initialData?.step) return Number(initialData.step);
    if (prefill?.step) return Number(prefill.step);
    const eff = { ...(prefill || {}), ...(initialData || {}) };
    if (eff.bankName || eff.accountNumber || eff.ifsc) return 4;
    if (eff.panNumber || eff.aadhaarNumber) return 3;
    if (eff.name || eff.ownerName || eff.mobile || eff.phone) return 2;
    return 1;
  });
  const [formData, setFormData] = useState(getBlank);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [fileFeedback, setFileFeedback] = useState(null);

  // Business Phone Dummy OTP Verification State (Development Flow)
  const [phoneVerified, setPhoneVerified] = useState(() => {
    if (isEditing) return true;
    if (initialData?.mobile && (initialData?.status === 'Approved' || initialData?.status === 'Active')) return true;
    return false;
  });
  const [verifiedPhone, setVerifiedPhone] = useState(() => {
    if (isEditing) return initialData?.mobile || '';
    if (initialData?.mobile && (initialData?.status === 'Approved' || initialData?.status === 'Active')) return initialData?.mobile || '';
    return '';
  });
  const [otpSent, setOtpSent] = useState(false);
  const [dummyOtp, setDummyOtp] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Generate random 6-digit numeric OTP with leading zeros if generated, different from previous OTP
  const generateRandomSixDigitOtp = (previousOtp) => {
    let newOtp;
    do {
      newOtp = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    } while (newOtp === previousOtp);
    return newOtp;
  };

  const handleSendOtp = async () => {
    const clean = String(formData.mobile || '').trim().replace(/\D/g, '').slice(-10);
    if (!clean || !phoneOk(clean)) {
      setErrors(p => ({ ...p, mobile: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' }));
      return;
    }

    setOtpSending(true);
    setOtpError('');
    setOtpSuccess('');
    setPhoneVerified(false);
    setVerifiedPhone('');
    setOtpCode(''); // Clean input so user enters the OTP

    // Generate local random OTP that is guaranteed to change on every resend
    const localOtp = generateRandomSixDigitOtp(dummyOtp);

    try {
      let assignedOtp = localOtp;
      try {
        const res = await vendorService.sendVendorPhoneOtp(clean);
        if (res && res.success) {
          if (res.otp) {
            assignedOtp = String(res.otp).padStart(6, '0');
            if (assignedOtp === dummyOtp) {
              assignedOtp = generateRandomSixDigitOtp(dummyOtp);
            }
          }
          setResendCooldown(res.cooldownSeconds || 30);
        } else if (res && res.cooldown) {
          setOtpError(res.message || 'Please wait before requesting a new OTP.');
          setResendCooldown(res.remainingSeconds || 30);
          return;
        }
      } catch (apiErr) {
        // Fallback for development testing if backend is offline
        console.warn('Backend OTP API error, using development dummy OTP:', apiErr);
        setResendCooldown(30);
      }

      setDummyOtp(assignedOtp);
      setOtpPhone(clean);
      setOtpExpiresAt(Date.now() + 5 * 60 * 1000); // 5 minutes validity
      setOtpAttempts(0);
      setOtpSent(true);
      setOtpSuccess(`OTP generated successfully for +91 ${clean}. Valid for 5 minutes.`);
    } catch (err) {
      setOtpError(err.message || 'Failed to send OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const clean = String(formData.mobile || '').trim().replace(/\D/g, '').slice(-10);
    const code = String(otpCode || '').trim();

    if (!clean || !phoneOk(clean)) {
      setOtpError('Invalid mobile number. Please check the mobile number.');
      return;
    }

    if (clean !== otpPhone) {
      setOtpError('Mobile number has changed. Please request a new OTP for this number.');
      return;
    }

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setOtpError('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    if (otpExpiresAt && Date.now() > otpExpiresAt) {
      setOtpError('OTP has expired. Please request a new OTP.');
      return;
    }

    if (otpAttempts >= 5) {
      setOtpError('Maximum verification attempts exceeded. Please request a new OTP.');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');

    try {
      const isCodeMatch = dummyOtp && code === dummyOtp;

      // Also call backend verification API if available
      let backendVerified = false;
      try {
        const res = await vendorService.verifyVendorPhoneOtp(clean, code);
        if (res && res.success && res.verified) {
          backendVerified = true;
        }
      } catch (_) {}

      if (isCodeMatch || backendVerified) {
        setPhoneVerified(true);
        setVerifiedPhone(clean);
        setOtpSuccess('Mobile number verified successfully.');
        setOtpError('');
        setErrors(p => {
          const next = { ...p };
          delete next.mobile;
          return next;
        });
      } else {
        const nextAttempts = otpAttempts + 1;
        setOtpAttempts(nextAttempts);
        const remaining = 5 - nextAttempts;
        if (remaining > 0) {
          setOtpError(`Incorrect OTP. ${remaining} attempt(s) remaining.`);
        } else {
          setOtpError('Maximum verification attempts exceeded. Please request a new OTP.');
        }
        setPhoneVerified(false);
        setVerifiedPhone('');
      }
    } catch (err) {
      setOtpError(err.message || 'OTP verification failed.');
    } finally {
      setOtpVerifying(false);
    }
  };

  useEffect(() => {
    setFormData(getBlank());
  }, [initialData, prefill]);

  const upd = (k, v) => {
    setFormData(p => {
      const nextData = { ...p, [k]: v };
      if (errors[k] || touched[k]) {
        const err = validateField(k, v, nextData);
        setErrors(prev => {
          const nextErr = { ...prev };
          if (err) nextErr[k] = err;
          else delete nextErr[k];
          return nextErr;
        });
      }
      if (k === 'gstStatus') {
        const gstErr = validateField('gstNumber', nextData.gstNumber, nextData);
        setErrors(prev => {
          const nextErr = { ...prev };
          if (gstErr) nextErr.gstNumber = gstErr;
          else delete nextErr.gstNumber;
          return nextErr;
        });
      }
      return nextData;
    });
  };

  const onChange = e => {
    const { name, value, type, checked } = e.target;
    upd(name, type === "checkbox" ? checked : value);
  };

  const handleNameChange = e => {
    const raw = e.target.value;
    const formatted = formatName(raw);
    upd('name', formatted);
  };

  // Time Slot State & Handlers
  const [slotFrom, setSlotFrom] = useState('09:00 AM');
  const [slotTo, setSlotTo] = useState('09:00 PM');
  const [slotDays, setSlotDays] = useState('All Days');
  const [slotAppliedMessage, setSlotAppliedMessage] = useState('');

  const applySlot = (from, to, days) => {
    let result = '';
    if (from === 'Open 24/7' || to === 'Open 24/7') {
      result = 'Open 24/7';
    } else {
      result = `${from} - ${to}`;
      if (days && days !== 'All Days') {
        result += ` (${days})`;
      }
    }
    upd('operatingHours', result);
    setSlotAppliedMessage('Time slot set to ' + result);
    setTimeout(() => setSlotAppliedMessage(''), 2500);
  };

  const handlePresetClick = (preset) => {
    if (preset.slot === 'Open 24/7') {
      setSlotFrom('Open 24/7');
      setSlotTo('Open 24/7');
      applySlot('Open 24/7', 'Open 24/7', slotDays);
      return;
    }
    const match = preset.slot.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/);
    if (match) {
      setSlotFrom(match[1]);
      setSlotTo(match[2]);
      applySlot(match[1], match[2], slotDays);
    }
  };
  const [showPw,setShowPw]=useState(false);
  const [showCPw,setShowCPw]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [globalError,setGlobalError]=useState('');
  const [uploadingDoc,setUploadingDoc]=useState(false);
  const [uploadingImgs, setUploadingImgs] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [pincodes, setPincodes] = useState([]);
  const logoRef = useRef(null), imgRef = useRef(null), licenseRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const initTerritoryOptions = async () => {
      try {
        setFormData(p => {
          const next = { ...p };
          if (isStateLocked && userStateId) next.stateId = userStateId;
          if (isDistrictLocked && userDistrictId) next.districtId = userDistrictId;
          if (isDivisionLocked && userDivisionId) next.divisionId = userDivisionId;
          if (isPincodeLocked && userPincodeId) next.pincodeId = userPincodeId;
          return next;
        });

        // 1. If State Manager: load districts for assigned state
        if (isStateManager && userStateId) {
          const r = await locationService.getDistricts(userStateId);
          if (isMounted && r && r.success) {
            setDistricts(Array.isArray(r.data) ? r.data : Array.isArray(r.districts) ? r.districts : []);
          }
        }

        // 2. Load divisions:
        // District Manager: divisions for assigned district
        // State Manager: divisions for selected district (if already set)
        const activeDistrictId = isDistrictLocked ? userDistrictId : formData.districtId;
        if (activeDistrictId && !isDivisionLocked) {
          const r = await locationService.getDivisions(activeDistrictId);
          if (isMounted && r && r.success) {
            setDivisions(Array.isArray(r.data) ? r.data : Array.isArray(r.divisions) ? r.divisions : []);
          }
        }

        // 3. Load pincodes:
        // Division Manager: pincodes for assigned division
        // State / District Manager: pincodes for selected division (if already set)
        const activeDivisionId = isDivisionLocked ? userDivisionId : formData.divisionId;
        if (activeDivisionId && !isPincodeLocked) {
          const r = await locationService.getPincodes(activeDivisionId);
          if (isMounted && r && r.success) {
            setPincodes(Array.isArray(r.data) ? r.data : Array.isArray(r.pincodes) ? r.pincodes : []);
          }
        }
      } catch (e) {
        console.error('Territory initialization error:', e);
      }
    };
    initTerritoryOptions();
    return () => { isMounted = false; };
  }, [user, role, isStateManager, isDistrictLocked, isDivisionLocked, isPincodeLocked, userStateId, userDistrictId, userDivisionId, userPincodeId]);

  const handleDistrictChange = async (e) => {
    const id = e.target.value;
    setFormData(p => ({ ...p, districtId: id, divisionId: '', pincodeId: '' }));
    setDivisions([]);
    setPincodes([]);
    if (errors.districtId || errors.divisionId || errors.pincodeId) {
      setErrors(p => {
        const next = { ...p };
        delete next.districtId;
        delete next.divisionId;
        delete next.pincodeId;
        return next;
      });
    }
    if (id) {
      try {
        const r = await locationService.getDivisions(id);
        if (r && r.success) setDivisions(Array.isArray(r.data) ? r.data : Array.isArray(r.divisions) ? r.divisions : []);
      } catch (err) {
        console.error('Error fetching divisions:', err);
      }
    }
  };

  const handleDivisionChange = async (e) => {
    const id = e.target.value;
    setFormData(p => ({ ...p, divisionId: id, pincodeId: '' }));
    setPincodes([]);
    if (errors.divisionId || errors.pincodeId) {
      setErrors(p => {
        const next = { ...p };
        delete next.divisionId;
        delete next.pincodeId;
        return next;
      });
    }
    if (id) {
      try {
        const r = await locationService.getPincodes(id);
        if (r && r.success) setPincodes(Array.isArray(r.data) ? r.data : Array.isArray(r.pincodes) ? r.pincodes : []);
      } catch (err) {
        console.error('Error fetching pincodes:', err);
      }
    }
  };

  const onLogo = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setErrors(p => ({ ...p, logo: 'Shop logo must not exceed 2MB.' }));
      setGlobalError('Shop logo must not exceed 2MB.');
      if (logoRef.current) logoRef.current.value = '';
      if (e.target) e.target.value = '';
      return;
    }
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!validExts.includes(ext) || !f.type.startsWith('image/')) {
      setErrors(p => ({ ...p, logo: 'Invalid file type. Only JPG, PNG, and WEBP image files are accepted.' }));
      if (logoRef.current) logoRef.current.value = '';
      if (e.target) e.target.value = '';
      return;
    }
    setErrors(p => { const next = { ...p }; delete next.logo; return next; });
    upd('logoPreview', URL.createObjectURL(f));
    try {
      const res = await uploadService.uploadPhoto(f);
      if (res && res.success) {
        const logoUrl = res.avatarUrl || res.file?.url;
        upd('logo', logoUrl || f);
        if (logoUrl) upd('logoPreview', logoUrl);
        setFileFeedback({ message: 'Shop logo uploaded successfully' });
        setTimeout(() => setFileFeedback(null), 2500);
      } else {
        upd('logo', f);
      }
    } catch (err) {
      console.warn('Immediate logo upload warning, will retry on submit:', err);
      upd('logo', f);
    }
  };

  const handleRemoveLogo = async (e) => {
    if (e) e.stopPropagation();
    try {
      const cur = formData.logo;
      const targetUrl = typeof cur === 'string' ? cur : cur?.url;
      if (targetUrl && targetUrl.startsWith('/uploads')) {
        await uploadService.deleteFile(targetUrl);
      }
    } catch (err) {
      console.warn('Could not delete logo from server:', err);
    }
    setFormData(p => ({ ...p, logo: null, logoPreview: null }));
    if (logoRef.current) logoRef.current.value = '';
    setFileFeedback({ message: 'Shop logo removed' });
    setTimeout(() => setFileFeedback(null), 2500);
  };

  const onImgs = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    // Check file types (images only)
    const invalidType = rawFiles.find(f => !f.type.startsWith('image/') && !['.jpg', '.jpeg', '.png', '.webp'].some(ext => f.name.toLowerCase().endsWith(ext)));
    if (invalidType) {
      setErrors(p => ({ ...p, businessImages: 'Invalid file type. Only JPG, PNG, and WEBP image files are accepted.' }));
      setGlobalError('Invalid file type. Only JPG, PNG, and WEBP image files are accepted.');
      if (e.target) e.target.value = '';
      return;
    }

    // Check size limit: max 5MB per image
    const oversized = rawFiles.find(f => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setErrors(p => ({ ...p, businessImages: 'Each business image must not exceed 5MB.' }));
      setGlobalError('Each business image must not exceed 5MB.');
      if (e.target) e.target.value = '';
      return;
    }

    // Check count limit: max 5 images total
    const currentImgs = formData.businessImages || [];
    const availableSlots = Math.max(0, 5 - currentImgs.length);
    if (availableSlots <= 0) {
      setErrors(p => ({ ...p, businessImages: 'Maximum of 5 business images allowed.' }));
      setGlobalError('Maximum of 5 business images allowed.');
      if (e.target) e.target.value = '';
      return;
    }

    const filesToUpload = rawFiles.slice(0, availableSlots);
    setErrors(p => { const next = { ...p }; delete next.businessImages; return next; });
    setGlobalError('');

    // Generate immediate local preview blobs for smooth user feedback
    const tempPreviews = filesToUpload.map(f => URL.createObjectURL(f));
    const combinedPreviews = [...(formData.businessImagePreviews || []), ...tempPreviews].slice(0, 5);
    upd('businessImagePreviews', combinedPreviews);

    setUploadingImgs(true);
    try {
      const uploadResults = await Promise.all(
        filesToUpload.map(async (file) => {
          const res = await uploadService.uploadBusinessImage(file);
          if (res && res.success && res.file) {
            return res.file;
          }
          if (res && res.url) {
            return {
              url: res.url,
              name: file.name,
              filename: res.url.split('/').pop(),
              size: file.size,
              type: file.type
            };
          }
          throw new Error(res?.message || `Failed to upload "${file.name}"`);
        })
      );

      const allSavedImgs = [...(formData.businessImages || []), ...uploadResults].slice(0, 5);
      upd('businessImages', allSavedImgs);
      upd('businessImagePreviews', allSavedImgs.map(img => typeof img === 'string' ? img : img.url || ''));
      setFileFeedback({ message: `${uploadResults.length} business image(s) uploaded successfully` });
      setTimeout(() => setFileFeedback(null), 2500);
    } catch (err) {
      console.error('Error uploading business images:', err);
      setErrors(p => ({ ...p, businessImages: err.message || 'Failed to upload business images.' }));
      setGlobalError(err.message || 'Failed to upload business images. Please try again.');
    } finally {
      setUploadingImgs(false);
      if (e.target) e.target.value = '';
    }
  };

  const rmImg = async (idx) => {
    const targetImg = (formData.businessImages || [])[idx];
    const imgUrl = typeof targetImg === 'string' ? targetImg : targetImg?.url;
    if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('/uploads')) {
      try {
        await uploadService.deleteFile(imgUrl);
      } catch (err) {
        console.warn('Could not delete image from server:', err);
      }
    }
    upd('businessImages', (formData.businessImages || []).filter((_, i) => i !== idx));
    upd('businessImagePreviews', (formData.businessImagePreviews || []).filter((_, i) => i !== idx));
  };

  const onLicense = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErrors(p => ({ ...p, businessLicense: 'Business document must not exceed 5MB.' }));
      setGlobalError('Business document must not exceed 5MB.');
      if (licenseRef.current) licenseRef.current.value = '';
      if (e.target) e.target.value = '';
      return;
    }
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (!validExts.includes(ext)) {
      setErrors(p => ({ ...p, businessLicense: 'Invalid document type. Only PDF, JPG, PNG, and WEBP documents are accepted.' }));
      if (licenseRef.current) licenseRef.current.value = '';
      if (e.target) e.target.value = '';
      return;
    }
    setErrors(p => { const next = { ...p }; delete next.businessLicense; return next; });
    try {
      const res = await uploadService.uploadDocument(f);
      if (res && res.success && res.file) {
        upd('businessLicense', res.file);
        setFileFeedback({ message: 'Business license uploaded successfully' });
        setTimeout(() => setFileFeedback(null), 2500);
      } else {
        upd('businessLicense', f);
      }
    } catch (err) {
      console.warn('Immediate license upload warning, will retry on submit:', err);
      upd('businessLicense', f);
    }
  };

  const handleRemoveLicense = async (e) => {
    if (e) e.stopPropagation();
    try {
      const cur = formData.businessLicense;
      if (typeof cur === 'string' && cur.startsWith('/uploads')) {
        await uploadService.deleteFile(cur);
      } else if (cur?.url) {
        await uploadService.deleteFile(cur.url);
      }
    } catch (err) {
      console.warn('Could not delete license from server:', err);
    }
    setFormData(p => ({ ...p, businessLicense: null }));
    if (licenseRef.current) licenseRef.current.value = '';
    setFileFeedback({ message: 'Business document removed' });
    setTimeout(() => setFileFeedback(null), 2500);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ((formData.documents || []).length >= 5) {
      setGlobalError('Maximum 5 additional KYC documents allowed.');
      if (e.target) e.target.value = '';
      return;
    }

    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      setGlobalError('Invalid document format. Only PDF, JPG, PNG, and WEBP documents are allowed.');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setGlobalError('Each additional KYC document must not exceed 5MB.');
      if (e.target) e.target.value = '';
      return;
    }
    setUploadingDoc(true);
    try {
      const r = await uploadService.uploadDocument(file);
      if (r && r.file) {
        upd('documents', [...(formData.documents || []), r.file]);
        setFileFeedback({ message: `"${file.name}" uploaded successfully` });
        setTimeout(() => setFileFeedback(null), 2500);
      } else {
        setGlobalError(r?.message || 'Failed to attach KYC document.');
      }
    } catch (err) {
      console.warn('KYC document upload error:', err);
      setGlobalError(err.message || 'Upload failed. Please check network connection and try again.');
    } finally {
      setUploadingDoc(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveDocument = async (idx, doc) => {
    const isApproved = initialData && ['Approved', 'Active', 'Completed'].includes(initialData.status);
    if (isApproved) {
      setGlobalError('Cannot delete documents permanently associated with an approved vendor.');
      return;
    }
    try {
      if (doc?.url) {
        await uploadService.deleteFile(doc.url);
      }
    } catch (err) {
      console.warn('Could not delete document from server:', err);
    }
    setFormData(p => ({
      ...p,
      documents: (p.documents || []).filter((_, i) => i !== idx)
    }));
    setFileFeedback({ message: `"${doc?.name || 'Document'}" removed` });
    setTimeout(() => setFileFeedback(null), 2500);
  };

  const validateField = (name, val, allData = formData) => {
    const value = val !== undefined && val !== null ? val : '';
    const strVal = typeof value === 'string' ? value.trim() : value;

    switch (name) {
      case 'businessName':
        if (!strVal) return 'Business name is required';
        if (strVal.length > 100) return 'Business name must not exceed 100 characters';
        return '';

      case 'category':
        if (!strVal) return 'Product/service category is required';
        return '';

      case 'mobile':
        if (!strVal) return 'Business phone number is required';
        const mobileErr = validateMobile(value, true, 'Business phone');
        if (mobileErr) return mobileErr;
        if ((!phoneVerified || (verifiedPhone && strVal !== verifiedPhone)) && !isEditing) {
          return 'Business phone must be verified via OTP';
        }
        return '';

      case 'email':
        return validateEmail(strVal, true) || '';

      case 'address':
        if (!strVal) return 'Business address is required';
        if (strVal.length > 250) return 'Business address must not exceed 250 characters';
        return '';

      case 'website':
        if (strVal) {
          try {
            const testUrl = strVal.startsWith('http://') || strVal.startsWith('https://') ? strVal : 'https://' + strVal;
            new URL(testUrl);
          } catch (e) {
            return 'Invalid website URL format (e.g. https://yourbusiness.com)';
          }
        }
        return '';

      case 'districtId':
        if (!isDistrictLocked && !value) return 'Please select a district within your state';
        return '';

      case 'divisionId':
        if (!isDivisionLocked && !value) return 'Please select a division within your district';
        return '';

      case 'pincodeId':
        if (!isPincodeLocked && !value) return 'Please select a pincode within your scope';
        if (isPincodeLocked && !userPincodeId && !userPincodeCode) return 'Assigned pincode is missing on manager account';
        return '';

      case 'name':
        return validateName(strVal, true, 'Owner / contact person name') || '';

      case 'alternatePhone':
        if (strVal) return validateMobile(strVal, false, 'Alternate phone') || '';
        return '';

      case 'agentName':
        if (strVal) return validateName(strVal, false, 'Agent name') || '';
        return '';

      case 'coPartnerName':
        if (strVal) return validateName(strVal, false, 'Co-partner name') || '';
        return '';

      case 'password':
        if (!isEditing) {
          return validatePassword(value, true) || '';
        }
        return '';

      case 'confirmPassword':
        if (!isEditing) {
          return validatePasswordMatch(allData.password, value) || '';
        }
        return '';

      case 'panNumber':
        if (strVal) return validatePan(strVal, false) || '';
        return '';

      case 'aadhaarNumber':
        if (strVal) return validateAadhaar(strVal, false) || '';
        return '';

      case 'gstNumber':
        if (allData.gstStatus === 'Registered') {
          if (!strVal) return 'GST number is required when GST status is Registered';
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(strVal.toUpperCase())) {
            return 'Invalid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5)';
          }
        } else if (strVal) {
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(strVal.toUpperCase())) {
            return 'Invalid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5)';
          }
        }
        return '';

      case 'accountHolderName':
        if (strVal) return validateName(strVal, false, 'Account Holder Name') || '';
        return '';

      case 'accountNumber':
        if (strVal) return validateAccountNumber(strVal, false, allData.bankName) || '';
        return '';

      case 'ifsc':
        if (strVal) return validateIfsc(strVal, false) || '';
        return '';

      case 'declaration':
        if (!value) return 'Please accept the declaration to proceed';
        return '';

      default:
        return '';
    }
  };

  const handleBlur = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setTouched(p => ({ ...p, [name]: true }));
    const err = validateField(name, val, formData);
    if (err) {
      setErrors(p => ({ ...p, [name]: err }));
    } else {
      setErrors(p => {
        const next = { ...p };
        delete next[name];
        return next;
      });
    }
  };

  const getStepFields = (s) => {
    switch (s) {
      case 1:
        return [
          'businessName', 'category', 'mobile', 'email', 'address', 'website',
          ...(!isDistrictLocked ? ['districtId'] : []),
          ...(!isDivisionLocked ? ['divisionId'] : []),
          ...(!isPincodeLocked ? ['pincodeId'] : [])
        ];
      case 2:
        return [
          'name', 'alternatePhone',
          ...(!isEditing ? ['password', 'confirmPassword'] : [])
        ];
      case 3:
        return ['panNumber', 'aadhaarNumber', 'gstNumber'];
      case 4:
        return ['accountNumber', 'ifsc'];
      case 5:
        return ['declaration'];
      default:
        return [];
    }
  };

  const validateStep = (s) => {
    const fields = getStepFields(s);
    const newErrors = {};
    if (s === 1 && territoryConfigError) {
      newErrors.territory = territoryConfigError;
    }
    if (s === 1 && (!phoneVerified || (verifiedPhone && formData.mobile !== verifiedPhone)) && !isEditing) {
      newErrors.mobile = 'Business phone must be verified via OTP before proceeding';
    }
    fields.forEach(f => {
      const err = validateField(f, formData[f], formData);
      if (err) newErrors[f] = err;
    });
    return newErrors;
  };

  const next = () => {
    const errs = validateStep(step);
    const touchedStep = {};
    getStepFields(step).forEach(f => { touchedStep[f] = true; });
    setTouched(p => ({ ...p, ...touchedStep }));

    if (Object.keys(errs).length > 0) {
      setErrors(prev => ({ ...prev, ...errs }));
      if (errs.territory) setGlobalError(errs.territory);
      const firstField = Object.keys(errs)[0];
      setTimeout(() => {
        const el = document.querySelector(`[name="${firstField}"]`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }
    setErrors({});
    setGlobalError('');
    setStep(s => s + 1);
  };

  const prev = () => {
    setErrors({});
    setGlobalError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    let firstFailingStep = null;
    let allErrors = {};

    for (let s = 1; s <= 5; s++) {
      const stepErrs = validateStep(s);
      if (Object.keys(stepErrs).length > 0) {
        if (!firstFailingStep) firstFailingStep = s;
        allErrors = { ...allErrors, ...stepErrs };
      }
    }

    if (firstFailingStep) {
      setErrors(allErrors);
      const allTouched = {};
      for (let s = 1; s <= 5; s++) {
        getStepFields(s).forEach(f => { allTouched[f] = true; });
      }
      setTouched(allTouched);
      setStep(firstFailingStep);
      setGlobalError('Please fix the highlighted required fields before submitting.');

      const firstField = Object.keys(allErrors)[0];
      setTimeout(() => {
        const el = document.querySelector(`[name="${firstField}"]`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setGlobalError('');
    setSubmitting(true);
    try {
      // 1. Resolve all business images to server URLs/objects
      const resolvedBusinessImages = [];
      for (const item of (formData.businessImages || [])) {
        if (typeof window !== 'undefined' && item instanceof File) {
          const res = await uploadService.uploadBusinessImage(item);
          if (res && res.success && res.file) {
            resolvedBusinessImages.push(res.file);
          } else if (res && res.url) {
            resolvedBusinessImages.push({
              url: res.url,
              name: item.name,
              filename: res.url.split('/').pop(),
              size: item.size,
              type: item.type
            });
          }
        } else if (item && typeof item === 'object') {
          if (item.url || item.filename || item.path) {
            resolvedBusinessImages.push(item);
          }
        } else if (typeof item === 'string' && item.trim()) {
          resolvedBusinessImages.push({
            url: item,
            name: item.split('/').pop() || 'Business Image',
            filename: item.split('/').pop() || '',
            type: 'image/jpeg'
          });
        }
      }

      // 2. Resolve logo
      let resolvedLogo = formData.logo;
      if (typeof window !== 'undefined' && formData.logo instanceof File) {
        const res = await uploadService.uploadPhoto(formData.logo);
        if (res && res.success) {
          resolvedLogo = res.avatarUrl || res.file?.url || resolvedLogo;
        }
      }

      // 3. Resolve business license
      let resolvedLicense = formData.businessLicense;
      if (typeof window !== 'undefined' && formData.businessLicense instanceof File) {
        const res = await uploadService.uploadDocument(formData.businessLicense);
        if (res && res.success && res.file) {
          resolvedLicense = res.file;
        }
      }

      const primaryStorefront = resolvedBusinessImages.length > 0 ? (resolvedBusinessImages[0].url || resolvedBusinessImages[0]) : null;

      const payload = {
        ...formData,
        businessImages: resolvedBusinessImages,
        logo: resolvedLogo,
        businessLicense: resolvedLicense,
        storefrontPhoto: formData.storefrontPhoto || primaryStorefront,
        shopPhoto: formData.shopPhoto || primaryStorefront,
        stateId: userStateId || formData.stateId,
        districtId: isDistrictLocked ? userDistrictId : formData.districtId,
        divisionId: isDivisionLocked ? userDivisionId : formData.divisionId,
        pincodeId: isPincodeLocked ? userPincodeId : formData.pincodeId,
        state: userStateName || formData.state,
        district: isDistrictLocked ? userDistrictName : (districts.find(d => String(d._id || d.id) === String(formData.districtId))?.name || formData.district),
        division: isDivisionLocked ? userDivisionName : (divisions.find(v => String(v._id || v.id) === String(formData.divisionId))?.name || formData.division),
        pincode: isPincodeLocked ? userPincodeCode : (pincodes.find(p => String(p._id || p.id) === String(formData.pincodeId))?.code || formData.pincode)
      };
      await onSubmit(payload);
    } catch (err) {
      setGlobalError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };
  const inp=(err=false)=>({width:'100%',padding:'8px 12px',fontSize:13,border:'1px solid '+(err?'#f87171':'var(--border)'),borderRadius:'var(--radius-sm)',background:'var(--surface)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'});
  const dashedBox={display:'flex',alignItems:'center',gap:12,padding:'10px 14px',border:'2px dashed var(--border)',borderRadius:'var(--radius-sm)',cursor:'pointer',transition:'border-color 0.2s'};
  const hb={onMouseEnter:e=>e.currentTarget.style.borderColor='var(--primary)',onMouseLeave:e=>e.currentTarget.style.borderColor='var(--border)'};
  const step1=(
    <div className="responsive-grid-2" style={{ gap: 16 }}>
      <div style={{gridColumn:'1/-1'}}><Field label="Business / Shop Name" required error={errors.businessName}><input type="text" name="businessName" maxLength={100} value={formData.businessName} onChange={onChange} onBlur={handleBlur} placeholder="e.g. Spice Route Bistro" className="form-input" style={inp(!!errors.businessName)}/></Field></div>
      <div style={{gridColumn:'1/-1'}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className="form-label" style={{ margin: 0 }}>Shop / Brand Logo</label>
          {(formData.logo || formData.logoPreview) && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              title="Remove shop logo"
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
        <div onClick={()=>logoRef.current?.click()} style={dashedBox} {...hb}>
          {formData.logoPreview ? (
            <img src={formData.logoPreview} alt="logo" style={{width:40,height:40,borderRadius:8,objectFit:'cover',border:'1px solid var(--border)',flexShrink:0}}/>
          ) : (
            <div style={{width:40,height:40,borderRadius:8,background:'var(--surface)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Camera size={18} color="var(--text-muted)"/>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--primary)'}}>
              {formData.logo ? (formData.logo.name || 'Logo attached') : 'Click to upload logo'}
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>PNG, JPG up to 2MB</div>
          </div>
          <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={onLogo}/>
        </div>
      </div>
      <Field label="Product / Service Category" required error={errors.category}><select name="category" value={formData.category} onChange={onChange} onBlur={handleBlur} className="form-select" style={inp(!!errors.category)}>{(CATEGORIES || []).map(c=><option key={c}>{c}</option>)}</select></Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Business Phone" required error={errors.mobile}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                maxLength={10}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  upd('mobile', val);
                  if (val !== verifiedPhone) {
                    setPhoneVerified(false);
                    setVerifiedPhone('');
                    setOtpSent(false);
                    setDummyOtp('');
                    setOtpCode('');
                    setOtpError('');
                    setOtpSuccess('');
                  }
                }}
                onBlur={handleBlur}
                placeholder="10-digit mobile number starting with 6-9"
                className="form-input"
                style={{ ...inp(!!errors.mobile), paddingRight: phoneVerified ? 120 : 12 }}
              />
              {phoneVerified && (
                <div style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <ShieldCheck size={13} /> Verified
                </div>
              )}
            </div>

            {!phoneVerified && (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending || resendCooldown > 0 || !formData.mobile || !phoneOk(formData.mobile)}
                style={{
                  background: (resendCooldown > 0 || !formData.mobile || !phoneOk(formData.mobile)) ? '#f1f5f9' : '#0284c7',
                  color: (resendCooldown > 0 || !formData.mobile || !phoneOk(formData.mobile)) ? '#94a3b8' : '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: (resendCooldown > 0 || !formData.mobile || !phoneOk(formData.mobile)) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  height: 38
                }}
              >
                {otpSending ? 'Sending...' : otpSent ? (resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP') : 'Send OTP'}
              </button>
            )}
          </div>
        </Field>

        {/* Development Dummy OTP Display and Verification Panel */}
        {otpSent && !phoneVerified && (
          <div style={{
            marginTop: 10,
            padding: '14px 16px',
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Clear Development OTP Box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              padding: '10px 14px',
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: '#d97706',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: 5
                }}>
                  Development OTP
                </span>
                <span style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#92400e',
                  letterSpacing: '3px',
                  fontFamily: 'monospace',
                  background: '#ffffff',
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: '1.5px dashed #d97706',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {dummyOtp}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                Temporary dummy OTP (Valid for 5 mins)
              </span>
            </div>

            {/* Confirmation message */}
            {otpSuccess && !otpError && (
              <div style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <CheckCircle2 size={15} color="#059669" />
                <span>{otpSuccess}</span>
              </div>
            )}

            {/* Separate OTP Input & Verify OTP Button */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Enter 6-digit OTP <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => {
                    const cleanCode = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(cleanCode);
                    if (otpError) setOtpError('');
                  }}
                  placeholder="Enter 6-digit OTP"
                  className="form-input"
                  style={{
                    ...inp(!!otpError),
                    width: 170,
                    letterSpacing: '0.25em',
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: 800,
                    textAlign: 'center',
                    height: 38
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || otpCode.length !== 6}
                  style={{
                    background: otpCode.length === 6 ? '#16a34a' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 18px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 38,
                    transition: 'all 0.15s'
                  }}
                >
                  {otpVerifying ? 'Verifying...' : 'Verify OTP'}
                </button>

                {resendCooldown > 0 && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Wait {resendCooldown}s to resend
                  </span>
                )}
              </div>
            </div>

            {/* Error message */}
            {otpError && (
              <div style={{
                fontSize: 12,
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                padding: '6px 10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6
              }}>
                <AlertCircle size={14} color="#dc2626" />
                <span>{otpError}</span>
              </div>
            )}
          </div>
        )}

        {/* Verified Status Banner */}
        {phoneVerified && (
          <div style={{
            marginTop: 6,
            fontSize: 12,
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600
          }}>
            <CheckCircle2 size={14} color="#059669" />
            <span>Mobile number verified successfully.</span>
          </div>
        )}
      </div>
      <Field label="Email Address" required error={errors.email}><input type="email" name="email" maxLength={100} value={formData.email} onChange={onChange} onBlur={handleBlur} placeholder="vendor@business.com" className="form-input" style={inp(!!errors.email)}/></Field>
      <Field label="Business Website (Optional)" error={errors.website}><input type="url" name="website" value={formData.website} onChange={onChange} onBlur={handleBlur} placeholder="https://yourwebsite.com" className="form-input" style={inp(!!errors.website)}/></Field>
      <div style={{gridColumn:'1/-1'}}><Field label="Business Address" required error={errors.address}><input type="text" name="address" maxLength={250} value={formData.address} onChange={onChange} onBlur={handleBlur} placeholder="Street, Area, City" className="form-input" style={inp(!!errors.address)}/></Field></div>
            {/* Business Operating Hours - Set Time Slot Method */}
      <div style={{ gridColumn: '1 / -1', marginTop: 6, marginBottom: 6 }}>
        <div style={{
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1.5px solid #cbd5e1',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
              }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Business Operating Hours & Time Slots
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Select or configure the standard working time slot
                </div>
              </div>
            </div>

            {formData.operatingHours && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
                background: '#ecfdf5',
                color: '#059669',
                border: '1.5px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 1px 3px rgba(5, 150, 105, 0.1)'
              }}>
                <CheckCircle size={13} /> Active Slot: {formData.operatingHours}
              </span>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700, marginBottom: 8 }}>
              Quick Preset Slots (1-Click Set)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_TIME_SLOTS.map((p) => {
                const isActive = formData.operatingHours?.startsWith(p.slot);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: isActive ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                      background: isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.3)' : '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <span>{p.label}</span>
                    <span style={{ opacity: isActive ? 0.9 : 0.65, fontSize: 10.5 }}>({p.slot})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time Slot Selector (From, To, Days + Set Button) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 10
          }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700, marginBottom: 8 }}>
              Custom Time Slot Picker
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              alignItems: 'flex-end'
            }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  From (Open Time)
                </label>
                <select
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  {TIME_SLOT_OPTIONS.map((t) => (
                    <option key={'from-' + t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  To (Close Time)
                </label>
                <select
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  {TIME_SLOT_OPTIONS.map((t) => (
                    <option key={'to-' + t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Operating Days
                </label>
                <select
                  value={slotDays}
                  onChange={(e) => setSlotDays(e.target.value)}
                  className="form-select"
                  style={{ ...inp(), height: 38, fontSize: 12.5, background: '#f8fafc', borderColor: '#cbd5e1' }}
                >
                  <option value="All Days">All Days (Mon - Sun)</option>
                  <option value="Mon - Sat">Mon - Sat</option>
                  <option value="Mon - Fri">Mon - Fri (Weekdays)</option>
                  <option value="Weekends Only">Weekends (Sat - Sun)</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => applySlot(slotFrom, slotTo, slotDays)}
                  className="btn btn-primary"
                  style={{
                    height: 38,
                    width: '100%',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)'
                  }}
                >
                  <Clock size={14} /> Set Time Slot
                </button>
              </div>
            </div>

            {slotAppliedMessage && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> {slotAppliedMessage}
              </div>
            )}
          </div>

          {/* Editable Slot String for Direct Edits */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              name="operatingHours"
              value={formData.operatingHours}
              onChange={onChange}
              placeholder="e.g. 09:00 AM - 09:00 PM"
              className="form-input"
              style={{ ...inp(), height: 36, fontSize: 12, background: '#ffffff', color: '#0f172a', fontWeight: 600, flex: 1 }}
            />
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
              Direct / Manual Override
            </span>
          </div>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}><Field label="Business Description"><textarea name="description" maxLength={1000} value={formData.description} onChange={onChange} rows={2} placeholder="Brief description..." className="form-input" style={{...inp(),resize:'vertical'}}/></Field></div>
      <div style={{gridColumn:'1/-1'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontWeight:700,fontSize:13}}>Location & Field Jurisdiction</span>
          <span style={{fontSize:11,padding:'2px 10px',borderRadius:20,background:'#ede9fe',color:'var(--primary)',fontWeight:600}}>Constrained to your Scope</span>
        </div>

        {territoryConfigError && (
          <div style={{
            padding: '8px 12px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            color: '#b91c1c',
            marginBottom: 10,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <AlertCircle size={14} />
            <span>{territoryConfigError}</span>
          </div>
        )}

        <div className="responsive-grid-4" style={{ gap: 12 }}>
          {/* State: Locked for all 4 roles */}
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>State <Lock size={11} color="var(--text-muted)"/></label>
            <input
              type="text"
              readOnly
              disabled
              className="form-input"
              value={userStateName || 'Unassigned State'}
              style={{...inp(), opacity: 0.85, background: 'var(--bg-subtle, #f8fafc)', cursor: 'not-allowed'}}
            />
            <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>Locked to your state scope</p>
          </div>

          {/* District: Locked for District, Division, Pincode managers; Enabled for State Manager */}
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>
              District {isDistrictLocked ? <Lock size={11} color="var(--text-muted)"/> : <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {isDistrictLocked ? (
              <>
                <input
                  type="text"
                  readOnly
                  disabled
                  className="form-input"
                  value={userDistrictName || 'Unassigned District'}
                  style={{...inp(), opacity: 0.85, background: 'var(--bg-subtle, #f8fafc)', cursor: 'not-allowed'}}
                />
                <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>Locked to your district scope</p>
              </>
            ) : (
              <>
                <select
                  name="districtId"
                  className="form-select"
                  value={formData.districtId}
                  onChange={handleDistrictChange}
                  style={inp(!!errors.districtId)}
                >
                  <option value="">Select District</option>
                  {(districts || []).map(d=><option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                </select>
                {errors.districtId && (
                  <p style={{fontSize:11,color:'#ef4444',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                    <AlertCircle size={11}/>{errors.districtId}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Division: Locked for Division, Pincode managers; Enabled for State, District managers */}
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>
              Division {isDivisionLocked ? <Lock size={11} color="var(--text-muted)"/> : <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {isDivisionLocked ? (
              <>
                <input
                  type="text"
                  readOnly
                  disabled
                  className="form-input"
                  value={userDivisionName || 'Unassigned Division'}
                  style={{...inp(), opacity: 0.85, background: 'var(--bg-subtle, #f8fafc)', cursor: 'not-allowed'}}
                />
                <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>Locked to your division scope</p>
              </>
            ) : (
              <>
                <select
                  name="divisionId"
                  className="form-select"
                  value={formData.divisionId}
                  onChange={handleDivisionChange}
                  disabled={!formData.districtId && !userDistrictId}
                  style={inp(!!errors.divisionId)}
                >
                  <option value="">Select Division</option>
                  {(divisions || []).map(d=><option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                </select>
                {errors.divisionId && (
                  <p style={{fontSize:11,color:'#ef4444',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                    <AlertCircle size={11}/>{errors.divisionId}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Pincode: Locked for Pincode manager; Enabled for State, District, Division managers */}
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:4}}>
              Pincode {isPincodeLocked ? <Lock size={11} color="var(--text-muted)"/> : <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {isPincodeLocked ? (
              <>
                <input
                  type="text"
                  readOnly
                  disabled
                  className="form-input"
                  value={`${userPincodeCode || ''}${userPincodeArea ? ` (${userPincodeArea})` : ''}`.trim() || 'Unassigned Pincode'}
                  style={{...inp(), opacity: 0.85, background: 'var(--bg-subtle, #f8fafc)', cursor: 'not-allowed'}}
                />
                <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>Locked to your pincode scope</p>
              </>
            ) : (
              <>
                <select
                  name="pincodeId"
                  className="form-select"
                  value={formData.pincodeId}
                  onChange={onChange}
                  disabled={!formData.divisionId && !userDivisionId}
                  style={inp(!!errors.pincodeId)}
                >
                  <option value="">Select Pincode</option>
                  {(pincodes || []).map(p=><option key={p._id || p.id} value={p._id || p.id}>{p.code} {p.areaName ? ` - ${p.areaName}` : p.name ? ` - ${p.name}` : ''}</option>)}
                </select>
                {errors.pincodeId && (
                  <p style={{fontSize:11,color:'#ef4444',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                    <AlertCircle size={11}/>{errors.pincodeId}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className="form-label" style={{ margin: 0 }}>
            Business Images <span style={{color:'var(--text-muted)',fontWeight:400}}>(Optional, max 5)</span>
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {(formData.businessImages || []).length} / 5 uploaded
          </span>
        </div>
        <div
          onClick={() => !uploadingImgs && (formData.businessImages || []).length < 5 && imgRef.current?.click()}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-sm)',
            cursor: uploadingImgs ? 'wait' : ((formData.businessImages || []).length < 5 ? 'pointer' : 'default'),
            minHeight: 52
          }}
          {...hb}
        >
          {(formData.businessImagePreviews || []).map((src, i) => (
            <div key={i} style={{position:'relative',flexShrink:0}}>
              <img
                src={src}
                alt={`Business proof ${i+1}`}
                style={{width:40,height:40,borderRadius:6,objectFit:'cover',border:'1px solid var(--border)'}}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23f1f5f9"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="9" fill="%2394a3b8">IMG</text></svg>';
                }}
              />
              <button
                type="button"
                onClick={ev => { ev.stopPropagation(); rmImg(i); }}
                title="Remove image"
                style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}
              >
                <X size={10} color="#fff"/>
              </button>
            </div>
          ))}
          {uploadingImgs && (
            <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--primary)',fontSize:12}}>
              <RefreshCw size={14} className="animate-spin" /> Uploading image(s)...
            </div>
          )}
          {!uploadingImgs && (formData.businessImages || []).length < 5 && (
            <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--text-muted)',fontSize:12}}>
              <ImageIcon size={15}/>{(formData.businessImages || []).length === 0 ? 'Upload business images' : 'Add more'}
            </div>
          )}
          <input ref={imgRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={onImgs} disabled={uploadingImgs}/>
        </div>
        {errors.businessImages && (
          <p style={{fontSize:11,color:'#ef4444',marginTop:4,display:'flex',alignItems:'center',gap:4}}>
            <AlertCircle size={11}/>{errors.businessImages}
          </p>
        )}
      </div>
    </div>
  );
  const step2=(
    <div className="responsive-grid-2" style={{ gap: 16 }}>
      <div style={{gridColumn:'1/-1'}}><Field label="Owner / Contact Person Name" required error={errors.name}><input type="text" name="name" maxLength={50} value={formData.name} onChange={handleNameChange} onBlur={handleBlur} placeholder="Full legal name" className="form-input" style={inp(!!errors.name)}/></Field></div>
      <Field label="Alternate Phone (Optional)" error={errors.alternatePhone}><input type="tel" name="alternatePhone" value={formData.alternatePhone||''} maxLength={10} onChange={e=>upd('alternatePhone',cleanMobile(e.target.value).slice(0,10))} onBlur={handleBlur} placeholder="Alternate number" className="form-input" style={inp(!!errors.alternatePhone)}/></Field>
      <Field label="Agent Name (Optional)"><input type="text" name="agentName" value={formData.agentName||''} onChange={e=>upd('agentName', formatName(e.target.value))} onBlur={handleBlur} placeholder="Agent name" className="form-input" style={inp()}/></Field>
      <div style={{gridColumn:'1/-1'}}><Field label="Co-partner Name (Optional)"><input type="text" name="coPartnerName" value={formData.coPartnerName||''} onChange={e=>upd('coPartnerName', formatName(e.target.value))} onBlur={handleBlur} placeholder="Co-partner name" className="form-input" style={inp()}/></Field></div>
      {!isEditing&&(<>
        <Field label="Account Password" required error={errors.password}><div style={{position:'relative'}}><input type={showPw?'text':'password'} name="password" value={formData.password} onChange={onChange} onBlur={handleBlur} placeholder="Min. 8 characters" className="form-input" style={{...inp(!!errors.password),paddingRight:36}}/><button type="button" onClick={()=>setShowPw(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></Field>
        <Field label="Confirm Password" required error={errors.confirmPassword}><div style={{position:'relative'}}><input type={showCPw?'text':'password'} name="confirmPassword" value={formData.confirmPassword} onChange={onChange} onBlur={handleBlur} placeholder="Re-enter password" className="form-input" style={{...inp(!!errors.confirmPassword),paddingRight:36}}/><button type="button" onClick={()=>setShowCPw(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}>{showCPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></Field>
      </>)}
    </div>
  );

  const step3=(
    <div className="responsive-grid-2" style={{ gap: 16 }}>
      <Field label="PAN Number" error={errors.panNumber}><input type="text" name="panNumber" value={formData.panNumber} maxLength={10} onChange={e=>upd('panNumber',cleanPan(e.target.value).slice(0,10))} onBlur={handleBlur} placeholder="e.g. ABCDE1234F" className="form-input" style={{...inp(!!errors.panNumber),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}/></Field>
      <Field label="Aadhaar Number" error={errors.aadhaarNumber}><input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} maxLength={12} onChange={e=>upd('aadhaarNumber',cleanAadhaar(e.target.value).slice(0,12))} onBlur={handleBlur} placeholder="12-digit Aadhaar" className="form-input" style={{...inp(!!errors.aadhaarNumber),fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em'}}/></Field>
      <Field label="GST Status"><select name="gstStatus" value={formData.gstStatus||'Registered'} onChange={onChange} onBlur={handleBlur} className="form-select" style={inp()}><option>Registered</option><option>Not Registered</option><option>Applied</option></select></Field>
      <Field label="GST Number" error={errors.gstNumber}><input type="text" name="gstNumber" value={formData.gstNumber} maxLength={15} onChange={e=>upd('gstNumber',e.target.value.toUpperCase())} onBlur={handleBlur} placeholder={formData.gstStatus === 'Registered' ? "e.g. 29ABCDE1234F1Z5 (Required)" : "e.g. 29ABCDE1234F1Z5 (Optional)"} className="form-input" style={{...inp(!!errors.gstNumber),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
      <Field label="MSME Status"><select name="msmeStatus" value={formData.msmeStatus||'Not Registered'} onChange={onChange} onBlur={handleBlur} className="form-select" style={inp()}><option>Registered</option><option>Not Registered</option><option>Applied</option></select></Field>
      <div style={{gridColumn:'1/-1'}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className="form-label" style={{ margin: 0 }}>Business License / Document</label>
          {formData.businessLicense && (
            <button
              type="button"
              onClick={handleRemoveLicense}
              title="Remove business license"
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
        <div onClick={()=>licenseRef.current?.click()} style={dashedBox} {...hb}>
          <div style={{width:36,height:36,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:formData.businessLicense?'#d1fae5':'var(--surface)',border:'1px solid var(--border)'}}>
            {formData.businessLicense ? <CheckCircle2 size={18} color="#10b981"/> : <Upload size={18} color="var(--text-muted)"/>}
          </div>
          <div style={{ flex: 1 }}>
            {formData.businessLicense ? (
              <>
                <div style={{fontSize:12,fontWeight:600,color:'#10b981'}}>File attached</div>
                <div style={{fontSize:11,color:'var(--text-muted)',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {formData.businessLicense.name || (typeof formData.businessLicense === 'string' ? formData.businessLicense.split('/').pop() : 'Business Document')}
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:12,fontWeight:600,color:'var(--primary)'}}>Click to upload business document</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>PDF, JPG, PNG up to 5MB</div>
              </>
            )}
          </div>
          <input ref={licenseRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={onLicense}/>
        </div>
      </div>
      <div style={{gridColumn:'1/-1'}}>
        <label className="form-label">Additional KYC Documents (PDF or Images, max 5MB)</label>
        <div style={{border:'2px dashed var(--border-strong)',borderRadius:'var(--radius-md)',padding:'20px',textAlign:'center',background:'#faf5ff'}}>
          <Upload size={24} style={{color:'var(--primary)',marginBottom:6}}/>
          <div style={{fontSize:'0.83rem',color:'var(--text-muted)',marginBottom:10}}>Select PAN card copy, GST registration, or Trade license</div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" onChange={handleFileUpload} disabled={uploadingDoc} style={{fontSize:'0.83rem'}}/>
          {uploadingDoc&&<span style={{fontSize:'0.8rem',color:'var(--primary)'}}> Uploading...</span>}
        </div>
        {formData.documents?.length > 0 && (
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
            {(formData.documents || []).map((doc,idx)=>(
              <div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:6,fontSize:12}}>
                <span style={{display:'flex',alignItems:'center',gap:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%'}}>
                  <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }}/>
                  <strong style={{ fontWeight: 600, color: '#334155' }}>{doc.name || 'KYC Document'}</strong>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{color:'var(--primary)',fontWeight:700,textDecoration:'none',fontSize:12}}>
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(idx, doc)}
                    title={`Remove ${doc.name || 'document'}`}
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const step4=(
    <div className="responsive-grid-2" style={{ gap: 16 }}>
      <div style={{gridColumn:'1/-1'}}><Field label="Account Holder Name" error={errors.accountHolderName}><input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={e=>upd('accountHolderName', formatName(e.target.value))} onBlur={handleBlur} placeholder="e.g. Spice Route Bistro LLP" className="form-input" style={inp(!!errors.accountHolderName)}/></Field></div>
      <Field label="Bank Name" error={errors.bankName}><input type="text" name="bankName" value={formData.bankName} onChange={onChange} onBlur={handleBlur} placeholder="e.g. HDFC Bank" className="form-input" style={inp(!!errors.bankName)}/></Field>
      <Field label="Bank Branch" error={errors.bankBranch}><input type="text" name="bankBranch" value={formData.bankBranch||''} onChange={onChange} onBlur={handleBlur} placeholder="Branch name" className="form-input" style={inp(!!errors.bankBranch)}/></Field>
      <Field label="Bank Street (Optional)"><input type="text" name="bankStreet" value={formData.bankStreet||''} onChange={onChange} onBlur={handleBlur} placeholder="Street address" className="form-input" style={inp()}/></Field>
      <Field label="Bank City (Optional)"><input type="text" name="bankCity" value={formData.bankCity||''} onChange={onChange} onBlur={handleBlur} placeholder="City" className="form-input" style={inp()}/></Field>
      <Field label="Account Number" error={errors.accountNumber}><input type="text" name="accountNumber" value={formData.accountNumber} maxLength={18} onChange={e=>upd('accountNumber',cleanAccountNumber(e.target.value).slice(0,18))} onBlur={handleBlur} placeholder="Bank Account Number" className="form-input" style={{...inp(!!errors.accountNumber),fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
      <Field label="IFSC Code" error={errors.ifsc}><input type="text" name="ifsc" value={formData.ifsc} maxLength={11} onChange={e=>upd('ifsc',cleanIfsc(e.target.value).slice(0,11))} onBlur={handleBlur} placeholder="e.g. HDFC0001234" className="form-input" style={{...inp(!!errors.ifsc),textTransform:'uppercase',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}/></Field>
    </div>
  );

  const step5=(
    <div style={{maxHeight:'55vh',overflowY:'auto',paddingRight:4}}>
      <RSection title="Business Information" icon={Store}><RRow label="Business Name" value={formData.businessName}/><RRow label="Category" value={formData.category}/><RRow label="Phone" value={formData.mobile}/><RRow label="Email" value={formData.email}/><RRow label="Address" value={formData.address}/><RRow label="Website" value={formData.website||'Not provided'}/><RRow label="Operating Hours" value={formData.operatingHours||'Not provided'}/></RSection>
      <RSection title="Owner Information" icon={User}><RRow label="Owner Name" value={formData.name}/><RRow label="Alternate Phone" value={formData.alternatePhone||'Not provided'}/><RRow label="Agent Name" value={formData.agentName||'Not provided'}/><RRow label="Co-partner" value={formData.coPartnerName||'Not provided'}/></RSection>
      <RSection title="Documents" icon={FileText}><RRow label="PAN Number" value={formData.panNumber||'Not provided'}/><RRow label="Aadhaar" value={formData.aadhaarNumber?maskAadhaar(formData.aadhaarNumber):'Not provided'}/><RRow label="GST Number" value={formData.gstNumber||'Not provided'}/><RRow label="GST Status" value={formData.gstStatus}/><RRow label="MSME Status" value={formData.msmeStatus}/><RRow label="Business License" value={formData.businessLicense?formData.businessLicense.name:'Not uploaded'}/></RSection>
      <RSection title="Bank Details" icon={CreditCard}><RRow label="Account Holder" value={formData.accountHolderName||'Not provided'}/><RRow label="Bank" value={formData.bankName||'Not provided'}/><RRow label="Branch" value={formData.bankBranch||'Not provided'}/><RRow label="Account No." value={formData.accountNumber?maskAccountNumber(formData.accountNumber):'Not provided'}/><RRow label="IFSC Code" value={formData.ifsc||'Not provided'}/></RSection>
      <div style={{borderRadius:10,border:'2px solid '+(errors.declaration?'#f87171':'var(--primary)'),padding:'14px 16px',background:errors.declaration?'#fef2f2':'rgba(99,102,241,0.04)',marginTop:4}}>
        <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
          <input type="checkbox" name="declaration" checked={formData.declaration} onChange={onChange} style={{marginTop:2,width:15,height:15,accentColor:'var(--primary)',flexShrink:0,cursor:'pointer'}}/>
          <span style={{fontSize:12,color:'var(--text-primary)',lineHeight:1.6}}>I declare that all the information provided is true and accurate to the best of my knowledge. I understand that providing false information may result in rejection of this application or legal action.</span>
        </label>
        {errors.declaration&&<p style={{marginTop:8,fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:4}}><AlertCircle size={11}/>{errors.declaration}</p>}
      </div>
    </div>
  );

  const stepContent=[step1,step2,step3,step4,step5];

  return (
    <div>
      <StepBar current={step}/>
      {fileFeedback && (
        <div style={{
          padding: '8px 14px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 8,
          color: '#065f46',
          marginBottom: 14,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <CheckCircle2 size={14} color="#059669" />
          <span>{fileFeedback.message}</span>
        </div>
      )}
      {globalError&&<div style={{padding:'10px 14px',background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,color:'#b91c1c',marginBottom:18,display:'flex',alignItems:'center',gap:8,fontSize:13}}><AlertCircle size={16}/><span>{globalError}</span></div>}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><h3 style={{fontSize:'1rem',fontWeight:700,margin:0}}>Step {step} of {STEPS.length} — {STEPS[step-1].label}</h3></div>
        <div className="card-body">{stepContent[step-1]}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button type="button" className="btn btn-secondary" onClick={step===1?onCancel:prev} style={{display:'flex',alignItems:'center',gap:6}}><ChevronLeft size={15}/>{step===1?'Cancel':'Back'}</button>
        <div style={{display:'flex',alignItems:'center',gap:6}}>{STEPS.map(s=>(<div key={s.id} style={{borderRadius:999,transition:'all 0.3s',width:s.id===step?20:8,height:8,background:s.id===step?'var(--primary)':s.id<step?'#7c3aed':'var(--border)'}}/>))}</div>
        {step<5?(<button type="button" className="btn btn-primary" onClick={next} style={{display:'flex',alignItems:'center',gap:6}}>Next <ChevronRight size={15}/></button>):(<button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{display:'flex',alignItems:'center',gap:6,background:submitting?undefined:'linear-gradient(135deg,#059669,#10b981)',borderColor:'transparent'}}>{submitting?'Saving...':<><BadgeCheck size={15}/>{isEditing?'Update Vendor':'Register Business'}</>}</button>)}
      </div>
    </div>
  );
};

export default VendorForm;