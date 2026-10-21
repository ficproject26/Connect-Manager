import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Building,
  Layers,
  Hash,
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Camera,
  X,
  Clock,
  Check,
  Compass,
  Calendar,
  CreditCard,
  FileText,
  FileCheck,
  PenTool,
  Home,
  CheckSquare,
  Square,
  Landmark,
  Banknote,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  formatName,
  validateName,
  normalizeEmail,
  validateEmail,
  cleanMobile,
  validateMobile,
  validatePassword,
  validatePasswordMatch,
  cleanAadhaar,
  validateAadhaar,
  cleanPan,
  validatePan,
  cleanAccountNumber,
  validateAccountNumber,
  cleanIfsc,
  validateIfsc,
  validateDob,
  getEighteenYearsAgoDateString,
  validateLocationName
} from '../utils/validation';

const ROLES = [
  {
    key: 'state_manager',
    label: 'State Manager',
    level: 1,
    limit: 8,
    scopeDesc: 'Entire State Operations',
    icon: Building,
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  {
    key: 'district_manager',
    label: 'District Manager',
    level: 2,
    limit: 2,
    scopeDesc: 'District Operations & Field Teams',
    icon: Shield,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  {
    key: 'division_manager',
    label: 'Division Manager',
    level: 3,
    limit: 2,
    scopeDesc: 'Sub-district / Division Oversight',
    icon: Layers,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  },
  {
    key: 'pincode_manager',
    label: 'PIN Code Manager',
    level: 4,
    limit: 2,
    scopeDesc: 'Hyper-local PIN Code Level',
    icon: MapPin,
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0'
  }
];

export const STEP_TITLES = [
  'Role Level',
  'Personal & Address',
  'Territory Jurisdiction',
  'KYC Documents',
  'Bank Details',
  'Review & Submit'
];

export default function Register({ 
  onNavigate, 
  initialUser = null, 
  initialFlowState = null, 
  initialToken = null,
  initialRejectionReason = ''
}) {
  const { setSession } = useAuth();

  const getInitialFlowState = (u, fs) => {
    if (fs) return fs;
    if (!u) return 'form';
    const st = String(u.overallRegistrationStatus || u.status || '').toLowerCase().trim();
    if (st === 'active' || st === 'approved') return 'approved';
    if (st === 'pending_kyc_verification' || st === 'pending_kyc_approval' || st === 'kyc_pending') return 'kyc_pending';
    if (['rejected', 'rejected_by_sub_admin', 'rejected_by_main_admin', 'kyc_rejected'].includes(st)) return 'rejected';
    if (st === 'pending_sub_admin_approval' || st === 'pending_main_admin_approval' || st === 'under_review') return 'under_review';
    return 'form';
  };

  // Form State - Credentials & Identity
  const [role, setRole] = useState(initialUser?.role || 'state_manager');
  const [name, setName] = useState(initialUser?.name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [mobile, setMobile] = useState(initialUser?.mobile || '');
  const [dob, setDob] = useState(initialUser?.dob || '');
  const [gender, setGender] = useState(initialUser?.gender || 'male');
  const [addressFields, setAddressFields] = useState({
    doorNumberStreet: initialUser?.residentialAddress?.doorNumberStreet || initialUser?.doorNumberStreet || (typeof initialUser?.address === 'string' ? initialUser.address : '') || '',
    villageTown: initialUser?.residentialAddress?.villageTown || initialUser?.villageTown || '',
    postOffice: initialUser?.residentialAddress?.postOffice || initialUser?.postOffice || '',
    taluk: initialUser?.residentialAddress?.taluk || initialUser?.taluk || '',
    district: initialUser?.residentialAddress?.district || initialUser?.district || '',
    state: initialUser?.residentialAddress?.state || initialUser?.state || '',
    pincode: initialUser?.residentialAddress?.pincode || initialUser?.pincode || ''
  });

  const handleAddressChange = (field, value) => {
    setAddressFields(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // KYC Document Uploads & Digital Signature
  const [aadharNumber, setAadharNumber] = useState(initialUser?.aadharNumber || initialUser?.documents?.aadharNumber || '');
  const [panNumber, setPanNumber] = useState(initialUser?.panNumber || initialUser?.documents?.panNumber || '');
  const [aadharError, setAadharError] = useState('');
  const [panError, setPanError] = useState('');

  const maskAadhaar = (num) => {
    if (!num) return null;
    const clean = String(num).replace(/\D/g, '');
    if (clean.length < 4) return '•••• •••• ••••';
    return `•••• •••• ${clean.slice(-4)}`;
  };

  const maskPan = (pan) => {
    if (!pan) return null;
    const clean = String(pan).toUpperCase().trim();
    if (clean.length < 4) return '••••••••••';
    return `${clean.slice(0, 2)}••••••${clean.slice(-2)}`;
  };

  const [aadharFile, setAadharFile] = useState(null);
  const [aadharPreview, setAadharPreview] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [panPreview, setPanPreview] = useState(null);
  const [bankFile, setBankFile] = useState(null);
  const [bankPreview, setBankPreview] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);

  // Declaration Acceptance
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Bank Details
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    bankName: '',
    branchName: '',
    street: '',
    city: '',
    accountNumber: '',
    ifscCode: ''
  });
  const [bankErrors, setBankErrors] = useState({});

  // Geographic Selection
  const [stateId, setStateId] = useState(initialUser?.scope?.stateId || initialUser?.stateId || '');
  const [districtId, setDistrictId] = useState(initialUser?.scope?.districtId || initialUser?.districtId || '');
  const [divisionId, setDivisionId] = useState(initialUser?.scope?.divisionId || initialUser?.divisionId || '');
  const [pincodeId, setPincodeId] = useState(initialUser?.scope?.pincodeId || initialUser?.pincodeId || '');

  // Location Data — states always loaded; lower levels are lazily loaded via cascading fetches
  const [states, setStates] = useState([]);
  const [filteredDistricts, setFilteredDistricts] = useState([]);
  const [filteredDivisions, setFilteredDivisions] = useState([]);
  const [filteredPincodes, setFilteredPincodes] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  // Capacity & Exclusivity Status
  const [capacityInfo, setCapacityInfo] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(false);

  // Profile Photo
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(initialUser?.avatarUrl || null);

  // Six-Step Wizard State & Searchable District (Bugs 2, 3, 4)
  const [currentStep, setCurrentStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [districtSearch, setDistrictSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchedDistricts = useMemo(() => {
    if (!districtSearch.trim()) return filteredDistricts;
    const q = districtSearch.toLowerCase().trim();
    return filteredDistricts.filter(d => (d.name || '').toLowerCase().includes(q));
  }, [filteredDistricts, districtSearch]);

  // UI Flow Status: 'form' | 'under_review' | 'kyc_pending' | 'rejected' | 'approved'
  const [flowState, setFlowState] = useState(() => getInitialFlowState(initialUser, initialFlowState));
  const [registeredUser, setRegisteredUser] = useState(initialUser || null);
  const [approvedToken, setApprovedToken] = useState(initialToken || null);
  const [rejectionReason, setRejectionReason] = useState(
    initialRejectionReason || initialUser?.rejectionReason || ''
  );

  // Sync if props change
  useEffect(() => {
    if (initialUser) {
      setRegisteredUser(initialUser);
      setFlowState(getInitialFlowState(initialUser, initialFlowState));
      if (initialToken) setApprovedToken(initialToken);
      if (initialRejectionReason || initialUser.rejectionReason) {
        setRejectionReason(initialRejectionReason || initialUser.rejectionReason);
      }
      if (initialUser.role) setRole(initialUser.role);
      if (initialUser.name) setName(initialUser.name);
      if (initialUser.email) setEmail(initialUser.email);
      if (initialUser.mobile) setMobile(initialUser.mobile);
      if (initialUser.dob) setDob(initialUser.dob);
      if (initialUser.gender) setGender(initialUser.gender);
      if (initialUser.aadharNumber || initialUser.documents?.aadharNumber) {
        setAadharNumber(initialUser.aadharNumber || initialUser.documents?.aadharNumber);
      }
      if (initialUser.panNumber || initialUser.documents?.panNumber) {
        setPanNumber(initialUser.panNumber || initialUser.documents?.panNumber);
      }
    }
  }, [initialUser, initialFlowState, initialToken, initialRejectionReason]);

  // Auto-refresh status on mount if arriving in review flow
  useEffect(() => {
    const targetUser = registeredUser || initialUser;
    const targetId = targetUser?.id || targetUser?._id || targetUser?.managerId || targetUser?.email;
    if (targetId && (flowState === 'under_review' || flowState === 'kyc_pending' || initialFlowState === 'under_review')) {
      authService.getRegistrationStatus(targetId).then(res => {
        if (res?.success && res?.data) {
          const updated = {
            ...(targetUser || {}),
            ...res.data,
            status: res.data.overallRegistrationStatus || res.data.status,
            subAdminApprovalStatus: res.data.subAdminApprovalStatus,
            mainAdminApprovalStatus: res.data.mainAdminApprovalStatus,
            kycVerificationStatus: res.data.kycVerificationStatus
          };
          setRegisteredUser(updated);
          setFlowState(getInitialFlowState(updated));
        }
      }).catch(() => {});
    }
  }, []);

  // Messages & Loading
  const [loading, setLoading] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  // Full Name formatting and validation using centralized utility:
  // - Auto-capitalize first letter of every name part
  // - Allow regional/international letters & valid name punctuation
  // - Strip leading spaces
  const formatAndValidateName = (rawVal) => {
    return formatName(rawVal);
  };

  const handleNameChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatName(rawVal);
    setName(formatted);

    // Validation while typing
    const trimmed = formatted.trim();
    if (!trimmed) {
      setNameError('');
      return;
    }
    const err = validateName(trimmed, false, 'Full Name');
    setNameError(err || '');
  };

  const handleNameBlur = () => {
    const trimmed = name.trim();
    setName(trimmed);
    const err = validateName(trimmed, true, 'Full Name');
    setNameError(err || '');
  };

  // Load states on mount (fast — no sync delay)
  useEffect(() => {
    const loadStates = async () => {
      setLocationsLoading(true);
      try {
        const res = await authService.getStates();
        const stateList = res.states || res.data || [];
        setStates(stateList);

        // Preselect first available state
        if (stateList.length > 0 && !stateId) {
          const available = stateList.find(s => !s.isFull) || stateList[0];
          setStateId(available._id || available.id);
        }
      } catch (err) {
        console.error('Failed to load states:', err);
      } finally {
        setLocationsLoading(false);
      }
    };
    loadStates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // When state changes, reset lower levels and fetch districts
  const handleStateChange = useCallback(async (newStId) => {
    setStateId(newStId);
    setDistrictId('');
    setDivisionId('');
    setPincodeId('');
    setFilteredDistricts([]);
    setFilteredDivisions([]);
    setFilteredPincodes([]);
    if (!newStId) return;
    try {
      const res = await authService.getDistricts(newStId);
      setFilteredDistricts(res.districts || res.data || []);
    } catch (err) {
      console.error('Failed to load districts:', err);
    }
  }, []);

  // When district changes, reset lower levels and fetch divisions
  const handleDistrictChange = useCallback(async (newDstId) => {
    setDistrictId(newDstId);
    setDivisionId('');
    setPincodeId('');
    setFilteredDivisions([]);
    setFilteredPincodes([]);
    if (!newDstId) return;
    try {
      const res = await authService.getDivisions(newDstId);
      setFilteredDivisions(res.divisions || res.data || []);
    } catch (err) {
      console.error('Failed to load divisions:', err);
    }
  }, []);

  // When division changes, reset pincodes and fetch them
  const handleDivisionChange = useCallback(async (newDivId) => {
    setDivisionId(newDivId);
    setPincodeId('');
    setFilteredPincodes([]);
    if (!newDivId) return;
    try {
      const res = await authService.getPincodes(newDivId);
      setFilteredPincodes(res.pincodes || res.data || []);
    } catch (err) {
      console.error('Failed to load pincodes:', err);
    }
  }, []);

  // Fetch districts when stateId is pre-populated (e.g. from initialUser)
  useEffect(() => {
    if (stateId && filteredDistricts.length === 0) {
      authService.getDistricts(stateId)
        .then(res => setFilteredDistricts(res.districts || res.data || []))
        .catch(() => {});
    }
  }, [stateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch divisions when districtId is pre-populated
  useEffect(() => {
    if (districtId && filteredDivisions.length === 0) {
      authService.getDivisions(districtId)
        .then(res => setFilteredDivisions(res.divisions || res.data || []))
        .catch(() => {});
    }
  }, [districtId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch pincodes when divisionId is pre-populated
  useEffect(() => {
    if (divisionId && filteredPincodes.length === 0) {
      authService.getPincodes(divisionId)
        .then(res => setFilteredPincodes(res.pincodes || res.data || []))
        .catch(() => {});
    }
  }, [divisionId]); // eslint-disable-line react-hooks/exhaustive-deps


  // Check Capacity / Place Vacancy when role or selected location changes
  useEffect(() => {
    const checkLocCapacity = async () => {
      // Determine if minimum required location for this role is chosen
      let isReadyToCheck = false;
      if (role === 'state_manager' && stateId) isReadyToCheck = true;
      if (role === 'district_manager' && districtId) isReadyToCheck = true;
      if (role === 'division_manager' && divisionId) isReadyToCheck = true;
      if (role === 'pincode_manager' && pincodeId) isReadyToCheck = true;

      if (!isReadyToCheck) {
        setCapacityInfo(null);
        return;
      }

      setCapacityLoading(true);
      try {
        const res = await authService.checkCapacity({
          role,
          stateId: stateId || '',
          districtId: districtId || '',
          divisionId: divisionId || '',
          pincodeId: pincodeId || ''
        });
        if (res.success) {
          setCapacityInfo(res);
        }
      } catch (err) {
        console.error('Failed to check capacity:', err);
      } finally {
        setCapacityLoading(false);
      }
    };

    checkLocCapacity();
  }, [role, stateId, districtId, divisionId, pincodeId]);

  // Handle Photo selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo size must not exceed 5MB');
        return;
      }
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setError('');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
  };

  // Handle KYC Document & Signature selection
  const handleDocSelect = (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const docNames = {
      aadhar: 'Aadhaar Card',
      pan: 'PAN Card',
      bank: 'Bank Passbook',
      signature: 'Digital Signature'
    };
    const docTitle = docNames[type] || 'Document';

    // Format validation: Only PDF, JPG, and PNG allowed
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileName = file.name || '';
    const fileExt = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    if (!allowedMimes.includes((file.type || '').toLowerCase()) && !allowedExtensions.includes(fileExt)) {
      setError(`Invalid file format for ${docTitle}. Only PDF, JPG, and PNG files are allowed.`);
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(`File size for ${docTitle} must not exceed 5MB.`);
      if (e.target) e.target.value = '';
      return;
    }

    const isImage = (file.type || '').startsWith('image/') || ['.jpg', '.jpeg', '.png'].includes(fileExt);
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    if (type === 'aadhar') {
      setAadharFile(file);
      setAadharPreview(previewUrl || file.name);
    } else if (type === 'pan') {
      setPanFile(file);
      setPanPreview(previewUrl || file.name);
    } else if (type === 'bank') {
      setBankFile(file);
      setBankPreview(previewUrl || file.name);
    } else if (type === 'signature') {
      setSignatureFile(file);
      setSignaturePreview(previewUrl || file.name);
    }
    setError('');
  };

  const handleRemoveDoc = (type) => {
    if (type === 'aadhar') {
      if (aadharPreview && aadharPreview.startsWith('blob:')) URL.revokeObjectURL(aadharPreview);
      setAadharFile(null);
      setAadharPreview(null);
    } else if (type === 'pan') {
      if (panPreview && panPreview.startsWith('blob:')) URL.revokeObjectURL(panPreview);
      setPanFile(null);
      setPanPreview(null);
    } else if (type === 'bank') {
      if (bankPreview && bankPreview.startsWith('blob:')) URL.revokeObjectURL(bankPreview);
      setBankFile(null);
      setBankPreview(null);
    } else if (type === 'signature') {
      if (signaturePreview && signaturePreview.startsWith('blob:')) URL.revokeObjectURL(signaturePreview);
      setSignatureFile(null);
      setSignaturePreview(null);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: '', color: '', percent: 0 };
    if (pwd.length < 6) return { label: 'Too Short (min 6)', color: '#ef4444', percent: 25 };
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const score = (hasLetters ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSpecial ? 1 : 0);

    if (score === 3 && pwd.length >= 8) return { label: 'Strong Password', color: '#10b981', percent: 100 };
    if (score >= 2) return { label: 'Medium Strength', color: '#f59e0b', percent: 65 };
    return { label: 'Weak', color: '#f97316', percent: 40 };
  };

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword && password === confirmPassword;

  // Step Validation & Error Tracking (Bugs 1, 2, 3)
  const validateStep = (step) => {
    const errors = {};
    if (step === 1) {
      if (!role) errors.role = 'Please select a manager role level.';
    } else if (step === 2) {
      const nameErr = validateName(name.trim(), true, 'Full Name');
      if (nameErr) errors.name = nameErr;

      const emailErr = validateEmail(email, true);
      if (emailErr) errors.email = emailErr;

      const mobileErr = validateMobile(mobile, true, 'Mobile number');
      if (mobileErr) errors.mobile = mobileErr;

      const dobErr = validateDob(dob, 18, true);
      if (dobErr) errors.dob = dobErr;

      if (!addressFields.doorNumberStreet.trim()) {
        errors.doorNumberStreet = 'Door Number / Street Name is required.';
      }
      const vtErr = validateLocationName(addressFields.villageTown, true, 'Village / Town Name');
      if (vtErr) errors.villageTown = vtErr;

      const poErr = validateLocationName(addressFields.postOffice, true, 'Post Office');
      if (poErr) errors.postOffice = poErr;

      const talukErr = validateLocationName(addressFields.taluk, true, 'Taluk');
      if (talukErr) errors.taluk = talukErr;

      const distErr = validateLocationName(addressFields.district, true, 'District');
      if (distErr) errors.district = distErr;

      const stErr = validateLocationName(addressFields.state, true, 'State');
      if (stErr) errors.state = stErr;

      const cleanPin = (addressFields.pincode || '').trim().replace(/\D/g, '');
      if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
        errors.pincode = 'Please enter a valid 6-digit Indian PIN Code starting with 1–9.';
      }

      const pwdErr = validatePassword(password, true);
      if (pwdErr) errors.password = pwdErr;

      const matchErr = validatePasswordMatch(password, confirmPassword);
      if (matchErr) errors.confirmPassword = matchErr;
    } else if (step === 3) {
      if (!stateId) errors.stateId = 'Please select an assigned State.';
      if (['district_manager', 'division_manager', 'pincode_manager'].includes(role) && !districtId) {
        errors.districtId = 'Please select an assigned District.';
      }
      if (['division_manager', 'pincode_manager'].includes(role) && !divisionId) {
        errors.divisionId = 'Please select an assigned Division.';
      }
      if (role === 'pincode_manager' && !pincodeId) {
        errors.pincodeId = 'Please select an assigned PIN Code.';
      }
      if (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager') {
        errors.jurisdiction = 'Selected jurisdiction is currently full. Please choose an alternate location.';
      }
    } else if (step === 4) {
      const aadharErr = validateAadhaar(aadharNumber, true);
      if (aadharErr) errors.aadharNumber = aadharErr;
      if (!aadharFile) errors.aadharFile = 'Aadhaar Card document upload is mandatory.';

      const panErr = validatePan(panNumber, true);
      if (panErr) errors.panNumber = panErr;
      if (!panFile) errors.panFile = 'PAN Card document upload is mandatory.';

      if (!bankFile) errors.bankFile = 'Bank Passbook / Cheque document upload is mandatory.';
      if (!signatureFile) errors.signatureFile = 'Digital Signature specimen upload is mandatory.';
    } else if (step === 5) {
      const holderErr = validateName(bankDetails.accountHolderName, true, 'Account Holder Name');
      if (holderErr) errors.accountHolderName = holderErr;
      if (!bankDetails.bankName.trim()) errors.bankName = 'Bank Name is required.';
      if (!bankDetails.branchName.trim()) errors.branchName = 'Bank Branch is required.';
      if (!bankDetails.city.trim()) errors.city = 'Bank City is required.';
      const accErr = validateAccountNumber(bankDetails.accountNumber, true, bankDetails.bankName);
      if (accErr) errors.accountNumber = accErr;
      const ifscErr = validateIfsc(bankDetails.ifscCode, true);
      if (ifscErr) errors.ifscCode = ifscErr;
    } else if (step === 6) {
      if (!declarationAccepted) {
        errors.declaration = 'Please accept the official undertaking and declaration before submitting.';
      }
    }

    setFieldErrors(prev => {
      const next = { ...prev };
      if (step === 1) delete next.role;
      if (step === 2) {
        ['name', 'email', 'mobile', 'dob', 'doorNumberStreet', 'villageTown', 'postOffice', 'taluk', 'district', 'state', 'pincode', 'password', 'confirmPassword'].forEach(k => delete next[k]);
      }
      if (step === 3) {
        ['stateId', 'districtId', 'divisionId', 'pincodeId', 'jurisdiction'].forEach(k => delete next[k]);
      }
      if (step === 4) {
        ['aadharNumber', 'aadharFile', 'panNumber', 'panFile', 'bankFile', 'signatureFile'].forEach(k => delete next[k]);
      }
      if (step === 5) {
        ['accountHolderName', 'bankName', 'branchName', 'city', 'accountNumber', 'ifscCode'].forEach(k => delete next[k]);
      }
      if (step === 6) delete next.declaration;
      return { ...next, ...errors };
    });

    return Object.keys(errors).length === 0;
  };

  const handleNextStep = (step) => {
    setError('');
    const isValid = validateStep(step);
    if (!isValid) {
      setError('Please fix the errors highlighted below before proceeding.');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 6));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSubmitting || loading) return;

    // Validate all 6 steps before final submission
    for (let s = 1; s <= 6; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        setError(`Please complete all required fields in Step ${s} (${STEP_TITLES[s - 1]}).`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager') {
      setError('Capacity reached for this location. Registration not allowed.');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // 1. Upload avatar if selected
      let uploadedAvatarUrl = null;
      if (avatarFile) {
        try {
          const uploadRes = await authService.uploadAvatar(avatarFile);
          if (uploadRes.success && uploadRes.avatarUrl) {
            uploadedAvatarUrl = uploadRes.avatarUrl;
          }
        } catch (uploadErr) {
          console.warn('Avatar upload failed, proceeding without photo:', uploadErr);
        }
      }

      // 2. Upload Mandatory KYC Documents & Signature (Strict - no mock fallbacks)
      let aadharUrl = null;
      let panUrl = null;
      let bankUrl = null;
      let signatureUrl = null;

      try {
        const res = await authService.uploadDocument(aadharFile);
        if (!res.success || !res.file?.url) {
          throw new Error(res.message || 'Aadhaar Card upload failed');
        }
        aadharUrl = res.file.url;
      } catch (e) {
        setError(`Aadhaar Card upload failed: ${e.message || 'Please check file and try again.'}`);
        setLoading(false);
        return;
      }

      try {
        const res = await authService.uploadDocument(panFile);
        if (!res.success || !res.file?.url) {
          throw new Error(res.message || 'PAN Card upload failed');
        }
        panUrl = res.file.url;
      } catch (e) {
        setError(`PAN Card upload failed: ${e.message || 'Please check file and try again.'}`);
        setLoading(false);
        return;
      }

      try {
        const res = await authService.uploadDocument(bankFile);
        if (!res.success || !res.file?.url) {
          throw new Error(res.message || 'Bank Passbook upload failed');
        }
        bankUrl = res.file.url;
      } catch (e) {
        setError(`Bank Passbook upload failed: ${e.message || 'Please check file and try again.'}`);
        setLoading(false);
        return;
      }

      try {
        const res = await authService.uploadDocument(signatureFile);
        if (!res.success || !res.file?.url) {
          throw new Error(res.message || 'Digital Signature upload failed');
        }
        signatureUrl = res.file.url;
      } catch (e) {
        setError(`Digital Signature upload failed: ${e.message || 'Please check file and try again.'}`);
        setLoading(false);
        return;
      }

      // 3. Submit Registration
      const regPayload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        dob,
        gender,
        address: [
          addressFields.doorNumberStreet.trim(),
          addressFields.villageTown.trim(),
          addressFields.postOffice.trim() ? `PO: ${addressFields.postOffice.trim()}` : '',
          addressFields.taluk.trim() ? `Taluk: ${addressFields.taluk.trim()}` : '',
          addressFields.district.trim(),
          addressFields.state.trim(),
          `PIN: ${addressFields.pincode.trim().replace(/\D/g, '')}`
        ].filter(Boolean).join(', '),
        residentialAddress: {
          doorNumberStreet: addressFields.doorNumberStreet.trim(),
          villageTown: addressFields.villageTown.trim(),
          postOffice: addressFields.postOffice.trim(),
          taluk: addressFields.taluk.trim(),
          district: addressFields.district.trim(),
          state: addressFields.state.trim(),
          pincode: addressFields.pincode.trim().replace(/\D/g, '')
        },
        password,
        role,
        aadharNumber: cleanAadhar,
        panNumber: cleanPan,
        documents: {
          aadharNumber: cleanAadhar,
          panNumber: cleanPan,
          aadharUrl,
          panUrl,
          bankUrl,
          signatureUrl,
          aadharCard: aadharUrl,
          panCard: panUrl,
          bankPassbook: bankUrl,
          digitalSignature: signatureUrl,
          aadharFileName: aadharFile.name,
          panFileName: panFile.name,
          bankFileName: bankFile.name,
          signatureFileName: signatureFile.name
        },
        declarationAccepted,
        stateId: stateId || null,
        districtId: districtId || null,
        divisionId: divisionId || null,
        pincodeId: pincodeId || null,
        avatarUrl: uploadedAvatarUrl,
        bankDetails: {
          accountHolderName: bankDetails.accountHolderName.trim(),
          bankName: bankDetails.bankName.trim(),
          branchName: bankDetails.branchName.trim(),
          street: bankDetails.street.trim() || null,
          city: bankDetails.city.trim(),
          accountNumber: bankDetails.accountNumber.trim().replace(/\s/g, ''),
          ifscCode: bankDetails.ifscCode.trim().toUpperCase()
        }
      };

      const res = await authService.register(regPayload);

      if (res.success) {
        setRegisteredUser(res.user);
        setFlowState('under_review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  // Live Registration Status Polling / Refresh
  const handleRefreshStatus = async () => {
    const targetId = registeredUser?.id || registeredUser?._id || registeredUser?.managerId || registeredUser?.email;
    if (!targetId) return;
    setRefreshingStatus(true);
    setError('');

    try {
      const res = await authService.getRegistrationStatus(targetId);
      if (res.success && res.data) {
        const updated = {
          ...registeredUser,
          ...res.data,
          status: res.data.overallRegistrationStatus || res.data.status,
          subAdminApprovalStatus: res.data.subAdminApprovalStatus,
          mainAdminApprovalStatus: res.data.mainAdminApprovalStatus,
          kycVerificationStatus: res.data.kycVerificationStatus
        };
        setRegisteredUser(updated);
        setFlowState(getInitialFlowState(updated));
        if (res.data.rejectionReason) {
          setRejectionReason(res.data.rejectionReason);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to refresh registration status.');
    } finally {
      setRefreshingStatus(false);
    }
  };

  const regStatusLower = String(registeredUser?.status || registeredUser?.overallRegistrationStatus || '').toLowerCase();
  const isSubAdminApproved = registeredUser?.subAdminApprovalStatus === 'approved' ||
    registeredUser?.adminApprovalStatus === 'approved' ||
    ['pending_main_admin_approval', 'pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(regStatusLower);

  const isMainAdminApproved = registeredUser?.mainAdminApprovalStatus === 'approved' ||
    ['pending_kyc_verification', 'pending_kyc_approval', 'kyc_pending', 'active', 'approved'].includes(regStatusLower);

  const isKycApproved = registeredUser?.kycVerificationStatus === 'approved' ||
    ['active', 'approved'].includes(regStatusLower);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    }}>
      {/* 1. Full-Width Top Header Bar */}
      <header className="register-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border-normal)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/assets/forge_badge.png" 
            alt="Forge India Connect" 
            style={{ width: '38px', height: '38px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              FORGE INDIA CONNECT
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--forge-gold-dark)', fontWeight: 700 }}>
              Agent Manager Registration &bull; Jurisdiction Allocation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('login')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={13} /> Back to Sign In
          </button>
        </div>
      </header>

      {/* 2. Full-Width Window-Fit Body (Horizontally Aligned) */}
      <main className="register-main" style={{
        flex: 1,
        width: '100%',
        padding: '20px 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Full-Width Horizontal Panoramic Welcome Banner */}
        <section aria-label="Registration banner" className="hero-welcome-card" style={{ margin: 0 }}>
          <div 
            className="hero-watermark-overlay" 
            style={{ backgroundImage: `url('/assets/temple_watermark.jpg')` }}
          />

          <div className="hero-top-row">
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: '#fef3c7',
                color: '#b45309',
                fontSize: '0.68rem',
                fontWeight: 700,
                marginBottom: '6px',
                border: '1px solid #fde68a'
              }}>
                <Shield size={12} /> Territorial Allocation Pipeline &bull; Real-time Verification
              </div>
              <h1 className="hero-greeting-title" style={{ fontSize: '1.45rem' }}>
                Manager Registration &bull; <span className="hero-greeting-name">Jurisdiction Authorization</span>
              </h1>
              <p className="hero-greeting-sub" style={{ fontSize: '0.85rem' }}>
                Apply for official State, District, Division, or PIN Code Manager authorization with real-time vacancy verification.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="hero-quote-box">
                “ Connecting Businesses <br />Creating Opportunities ”
              </div>
            </div>
          </div>

          {/* Horizontal Step Chain Breadcrumb */}
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.75rem',
            color: '#64748b'
          }}>
            <div className="location-scope-chain" style={{ margin: 0 }}>
              <div className="location-chain-item" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#b45309' }}>
                <span>1. Select Role</span>
              </div>
              <span className="location-chain-sep">››</span>
              <div className="location-chain-item" style={{ background: flowState !== 'form' ? '#dcfce7' : '#ffffff' }}>
                <span>2. Personal Details</span>
              </div>
              <span className="location-chain-sep">››</span>
              <div className="location-chain-item" style={{ background: flowState !== 'form' ? '#dcfce7' : '#ffffff' }}>
                <span>3. KYC Documents</span>
              </div>
              <span className="location-chain-sep">››</span>
              <div className="location-chain-item" style={{ background: flowState !== 'form' ? '#dcfce7' : '#ffffff' }}>
                <span>4. Jurisdiction</span>
              </div>
              <span className="location-chain-sep">››</span>
              <div className="location-chain-item" style={{
                background: flowState === 'under_review' ? '#fef3c7' : flowState === 'kyc_pending' ? '#e0f2fe' : flowState === 'approved' ? '#dcfce7' : '#ffffff',
                borderColor: flowState === 'under_review' ? '#fde68a' : flowState === 'kyc_pending' ? '#bae6fd' : flowState === 'approved' ? '#86efac' : 'var(--border-normal)',
                color: flowState === 'under_review' ? '#b45309' : flowState === 'kyc_pending' ? '#0369a1' : flowState === 'approved' ? '#15803d' : '#64748b',
                fontWeight: flowState !== 'form' ? 700 : 500
              }}>
                <span>
                  {flowState === 'under_review' && '5. Under Review'}
                  {flowState === 'kyc_pending' && '5. KYC Pending'}
                  {flowState === 'approved' && '5. Approved & Active'}
                  {flowState === 'form' && '5. Review & Approval'}
                </span>
              </div>
            </div>

            <div>
              Pan-India Jurisdiction Allocation &bull; <strong>36 States & UTs &bull; Cascading Hierarchy</strong>
            </div>
          </div>
        </section>

        {/* Global Error Banner */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-sm)',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.84rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ----------------- STATE 1: REGISTRATION FORM ----------------- */}
        {flowState === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ----------------- SIX-STEP WIZARD PROGRESS BAR (Bug 3) ----------------- */}
            <div className="card" style={{ margin: 0, padding: '14px 18px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Step {currentStep} of 6: {STEP_TITLES[currentStep - 1]}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    ({Math.round((currentStep / 6) * 100)}% Completed)
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 700 }}>
                  Role: {ROLES.find(r => r.key === role)?.label || 'State Manager'}
                </div>
              </div>

              {/* Progress Bar Track */}
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(currentStep / 6) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #f59e0b, #10b981)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Step Navigation Tabs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginTop: '12px' }}>
                {STEP_TITLES.map((title, idx) => {
                  const stepNum = idx + 1;
                  const isCurrent = currentStep === stepNum;
                  const isPast = currentStep > stepNum;
                  return (
                    <div
                      key={stepNum}
                      onClick={() => {
                        if (isPast) {
                          setCurrentStep(stepNum);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isCurrent ? '#fef3c7' : (isPast ? '#f0fdf4' : '#f8fafc'),
                        border: isCurrent ? '1.5px solid #f59e0b' : (isPast ? '1px solid #bbf7d0' : '1px solid #e2e8f0'),
                        cursor: isPast ? 'pointer' : 'default',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isCurrent ? '#f59e0b' : (isPast ? '#16a34a' : '#cbd5e1'),
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isPast ? <Check size={11} /> : stepNum}
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: isCurrent ? 800 : 600,
                        color: isCurrent ? '#92400e' : (isPast ? '#166534' : '#64748b'),
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ----------------- STEP 1: ROLE SELECTION ----------------- */}
            {currentStep === 1 && (
              <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                      1. Select Manager Role Level
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                    Hierarchy &bull; 4 Tier Architecture
                  </span>
                </div>

                <div className="card-body" style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="register-role-grid">
                    {ROLES.map((r) => {
                      const IconComponent = r.icon;
                      const isSelected = role === r.key;
                      return (
                        <div
                          key={r.key}
                          onClick={() => {
                            setRole(r.key);
                            if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
                          }}
                          style={{
                            border: isSelected ? `2px solid ${r.color}` : '1px solid var(--border-normal)',
                            background: isSelected ? r.bg : '#ffffff',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: isSelected ? `0 2px 8px ${r.border}` : 'var(--shadow-xs)'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: isSelected ? r.color : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <IconComponent size={20} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {r.label}
                              </span>
                              {isSelected && (
                                <div style={{
                                  background: r.color,
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Check size={11} />
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: isSelected ? r.color : '#64748b', fontWeight: 600, marginTop: '2px' }}>
                              {r.scopeDesc}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '1px' }}>
                              Capacity Limit: Max {r.limit} managers
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {fieldErrors.role && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#ef4444', fontWeight: 600 }}>
                      {fieldErrors.role}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ----------------- STEP 2: PERSONAL DETAILS & ADDRESS ----------------- */}
            {currentStep === 2 && (
              <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                      2. Personal Details, Address & Credentials
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Manager Identity & Operational Base
                  </span>
                </div>

                <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Photo Upload & Full Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      border: '2px dashed #cbd5e1',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0
                    }}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Camera size={22} style={{ color: '#94a3b8' }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                      <label style={{
                        padding: '5px 10px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Upload size={12} /> {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                        <input type="file" accept="image/png, image/jpeg, image/jpg" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Full Name Input */}
                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Full Name *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          required
                          maxLength={50}
                          className="form-input"
                          style={{
                            paddingLeft: '34px',
                            height: '38px',
                            fontSize: '0.84rem',
                            border: (fieldErrors.name || nameError) ? '1.5px solid #ef4444' : undefined,
                            background: (fieldErrors.name || nameError) ? '#fff5f5' : undefined
                          }}
                          placeholder="e.g. Ramesh Kumar"
                          value={name}
                          onChange={handleNameChange}
                          onBlur={() => {
                            const err = validateName(name.trim(), true, 'Full Name');
                            setFieldErrors(prev => ({ ...prev, name: err || '' }));
                          }}
                        />
                        <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: (fieldErrors.name || nameError) ? '#ef4444' : '#94a3b8' }} />
                      </div>
                      {(fieldErrors.name || nameError) && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.name || nameError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email & Mobile */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Official Email *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="email"
                          required
                          maxLength={100}
                          className="form-input"
                          style={{
                            paddingLeft: '34px',
                            height: '38px',
                            fontSize: '0.84rem',
                            border: fieldErrors.email ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="manager@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                          }}
                          onBlur={() => {
                            const err = validateEmail(email, true);
                            setFieldErrors(prev => ({ ...prev, email: err || '' }));
                          }}
                        />
                        <Mail size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: fieldErrors.email ? '#ef4444' : '#94a3b8' }} />
                      </div>
                      {fieldErrors.email && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Mobile Number *</label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: fieldErrors.mobile ? '1.5px solid #ef4444' : '1px solid var(--border-normal)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        overflow: 'hidden',
                        height: '38px',
                        backgroundColor: '#ffffff'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0 10px',
                          height: '100%',
                          backgroundColor: '#f8fafc',
                          borderRight: '1px solid #e2e8f0',
                          color: '#475569',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          userSelect: 'none',
                          flexShrink: 0
                        }}>
                          <Phone size={13} style={{ color: '#d97706' }} />
                          <span>+91</span>
                        </div>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder="10-digit mobile"
                          value={mobile}
                          onChange={(e) => {
                            setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                            if (fieldErrors.mobile) setFieldErrors(prev => ({ ...prev, mobile: '' }));
                          }}
                          onBlur={() => {
                            const err = validateMobile(mobile, true, 'Mobile number');
                            setFieldErrors(prev => ({ ...prev, mobile: err || '' }));
                          }}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            padding: '0 10px',
                            height: '100%',
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            background: 'transparent'
                          }}
                        />
                      </div>
                      {fieldErrors.mobile && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.mobile}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Date of Birth & Gender */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Date of Birth (DOB) *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="date"
                          required
                          max={getEighteenYearsAgoDateString()}
                          className="form-input"
                          style={{
                            paddingLeft: '34px',
                            height: '38px',
                            fontSize: '0.84rem',
                            border: fieldErrors.dob ? '1.5px solid #ef4444' : undefined
                          }}
                          value={dob}
                          onChange={(e) => {
                            setDob(e.target.value);
                            if (fieldErrors.dob) setFieldErrors(prev => ({ ...prev, dob: '' }));
                          }}
                          onBlur={() => {
                            const err = validateDob(dob, 18, true);
                            setFieldErrors(prev => ({ ...prev, dob: err || '' }));
                          }}
                        />
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: fieldErrors.dob ? '#ef4444' : '#94a3b8' }} />
                      </div>
                      {fieldErrors.dob && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.dob}
                        </p>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Gender *</label>
                      <select
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem' }}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        required
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Residential / Operational Address (7 Fields with Inline Validation - Bugs 1 & 2) */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                      <Home size={15} style={{ color: 'var(--primary, #0ea5e9)' }} />
                      Residential / Operational Address *
                    </div>

                    {/* Field 1: Door Number / Street Name */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                        1. Door Number / Street Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        style={{
                          height: '36px',
                          fontSize: '0.82rem',
                          border: fieldErrors.doorNumberStreet ? '1.5px solid #ef4444' : undefined
                        }}
                        placeholder="e.g. Door No. 12/4B, North Car Street"
                        value={addressFields.doorNumberStreet}
                        onChange={(e) => {
                          handleAddressChange('doorNumberStreet', e.target.value);
                          if (fieldErrors.doorNumberStreet) setFieldErrors(prev => ({ ...prev, doorNumberStreet: '' }));
                        }}
                        onBlur={() => {
                          if (!addressFields.doorNumberStreet.trim()) {
                            setFieldErrors(prev => ({ ...prev, doorNumberStreet: 'Door Number / Street Name is required.' }));
                          }
                        }}
                      />
                      {fieldErrors.doorNumberStreet && (
                        <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.doorNumberStreet}
                        </p>
                      )}
                    </div>

                    {/* Row 2: Village/Town & Post Office (Bugs 1 & 2 - Location validation) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          2. Village / Town Name *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.villageTown ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. Anna Nagar / Mettur"
                          value={addressFields.villageTown}
                          onChange={(e) => {
                            handleAddressChange('villageTown', e.target.value);
                            if (fieldErrors.villageTown) setFieldErrors(prev => ({ ...prev, villageTown: '' }));
                          }}
                          onBlur={() => {
                            const err = validateLocationName(addressFields.villageTown, true, 'Village / Town Name');
                            setFieldErrors(prev => ({ ...prev, villageTown: err || '' }));
                          }}
                        />
                        {fieldErrors.villageTown && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.villageTown}
                          </p>
                        )}
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          3. Post Office *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.postOffice ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. Mettur Dam SO"
                          value={addressFields.postOffice}
                          onChange={(e) => {
                            handleAddressChange('postOffice', e.target.value);
                            if (fieldErrors.postOffice) setFieldErrors(prev => ({ ...prev, postOffice: '' }));
                          }}
                          onBlur={() => {
                            const err = validateLocationName(addressFields.postOffice, true, 'Post Office');
                            setFieldErrors(prev => ({ ...prev, postOffice: err || '' }));
                          }}
                        />
                        {fieldErrors.postOffice && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.postOffice}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Taluk & District (Bugs 1 & 2 - Location validation) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          4. Taluk *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.taluk ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. Mettur Taluk"
                          value={addressFields.taluk}
                          onChange={(e) => {
                            handleAddressChange('taluk', e.target.value);
                            if (fieldErrors.taluk) setFieldErrors(prev => ({ ...prev, taluk: '' }));
                          }}
                          onBlur={() => {
                            const err = validateLocationName(addressFields.taluk, true, 'Taluk');
                            setFieldErrors(prev => ({ ...prev, taluk: err || '' }));
                          }}
                        />
                        {fieldErrors.taluk && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.taluk}
                          </p>
                        )}
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          5. District *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.district ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. Salem"
                          value={addressFields.district}
                          onChange={(e) => {
                            handleAddressChange('district', e.target.value);
                            if (fieldErrors.district) setFieldErrors(prev => ({ ...prev, district: '' }));
                          }}
                          onBlur={() => {
                            const err = validateLocationName(addressFields.district, true, 'District');
                            setFieldErrors(prev => ({ ...prev, district: err || '' }));
                          }}
                        />
                        {fieldErrors.district && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.district}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 4: State & PIN Code (Bugs 1 & 2 - Location validation) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          6. State *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.state ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. Tamil Nadu"
                          value={addressFields.state}
                          onChange={(e) => {
                            handleAddressChange('state', e.target.value);
                            if (fieldErrors.state) setFieldErrors(prev => ({ ...prev, state: '' }));
                          }}
                          onBlur={() => {
                            const err = validateLocationName(addressFields.state, true, 'State');
                            setFieldErrors(prev => ({ ...prev, state: err || '' }));
                          }}
                        />
                        {fieldErrors.state && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.state}
                          </p>
                        )}
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          7. PIN Code (6 Digits) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          className="form-input"
                          style={{
                            height: '36px',
                            fontSize: '0.82rem',
                            border: fieldErrors.pincode ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="e.g. 636401"
                          value={addressFields.pincode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            handleAddressChange('pincode', val);
                            if (fieldErrors.pincode) setFieldErrors(prev => ({ ...prev, pincode: '' }));
                          }}
                          onBlur={() => {
                            const clean = (addressFields.pincode || '').replace(/\D/g, '');
                            if (!/^[1-9][0-9]{5}$/.test(clean)) {
                              setFieldErrors(prev => ({ ...prev, pincode: 'Please enter a valid 6-digit Indian PIN Code starting with 1–9.' }));
                            }
                          }}
                        />
                        {fieldErrors.pincode && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                            {fieldErrors.pincode}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Passwords */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Password *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          className="form-input"
                          style={{
                            paddingLeft: '34px',
                            paddingRight: '34px',
                            height: '38px',
                            fontSize: '0.84rem',
                            border: fieldErrors.password ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                          }}
                          onBlur={() => {
                            const err = validatePassword(password, true);
                            setFieldErrors(prev => ({ ...prev, password: err || '' }));
                          }}
                        />
                        <Lock size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ position: 'absolute', right: '9px', top: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.password}
                        </p>
                      )}
                      {password && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, height: '3px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${pwdStrength.percent}%`, height: '100%', background: pwdStrength.color, transition: 'all 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '0.66rem', color: pwdStrength.color, fontWeight: 600 }}>
                            {pwdStrength.label}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Confirm Password *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          className="form-input"
                          style={{
                            paddingLeft: '34px',
                            paddingRight: '34px',
                            height: '38px',
                            fontSize: '0.84rem',
                            border: fieldErrors.confirmPassword ? '1.5px solid #ef4444' : undefined
                          }}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                          }}
                          onBlur={() => {
                            const err = validatePasswordMatch(password, confirmPassword);
                            setFieldErrors(prev => ({ ...prev, confirmPassword: err || '' }));
                          }}
                        />
                        <Lock size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{ position: 'absolute', right: '9px', top: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.confirmPassword}
                        </p>
                      )}
                      {confirmPassword && (
                        <div style={{ fontSize: '0.66rem', marginTop: '4px', fontWeight: 600, color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                          {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 3: ASSIGNED JURISDICTION & ALLOCATION ----------------- */}
            {currentStep === 3 && (
              <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                      3. Assigned Jurisdiction & Allocation
                    </h3>
                  </div>

                  {/* Live Capacity Indicator */}
                  {capacityLoading ? (
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Checking vacancy...</span>
                  ) : capacityInfo ? (
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: (capacityInfo.isFull && role !== 'pincode_manager') ? '#fee2e2' : '#dcfce7',
                      color: (capacityInfo.isFull && role !== 'pincode_manager') ? '#b91c1c' : '#15803d',
                      border: `1px solid ${(capacityInfo.isFull && role !== 'pincode_manager') ? '#fca5a5' : '#86efac'}`
                    }}>
                      {(capacityInfo.isFull && role !== 'pincode_manager') ? (
                        <>
                          <AlertCircle size={11} />
                          <span>Place Filled</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={11} />
                          <span>Available</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Select Location
                    </span>
                  )}
                </div>

                <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Row 1: State & District with Search (Bug 4) */}
                  <div className="responsive-grid-2">
                    {/* State */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>State *</span>
                        {role === 'state_manager' && <span style={{ color: '#f59e0b', fontSize: '0.68rem', fontWeight: 600 }}>Required</span>}
                      </label>
                      <select
                        id="reg-state-select"
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem', borderColor: fieldErrors.stateId ? '#ef4444' : undefined }}
                        value={stateId}
                        onChange={(e) => {
                          handleStateChange(e.target.value);
                          if (fieldErrors.stateId) setFieldErrors(prev => ({ ...prev, stateId: '' }));
                        }}
                        required
                      >
                        <option value="">Select State / UT</option>
                        {states.map((s) => {
                          const isFilled = role === 'state_manager' && s.isFull;
                          return (
                            <option
                              key={s._id || s.id}
                              value={s._id || s.id}
                              disabled={isFilled}
                              style={isFilled ? { color: '#94a3b8', background: '#f8fafc' } : {}}
                            >
                              {s.name}{s.code ? ` (${s.code})` : ''} {isFilled ? '⛔ (Place Filled)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {fieldErrors.stateId && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.stateId}
                        </p>
                      )}
                    </div>

                    {/* District (Searchable Dropdown - Bug 4) */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>District {['district_manager', 'division_manager', 'pincode_manager'].includes(role) ? '*' : ''}</span>
                        {role === 'district_manager' && <span style={{ color: '#0284c7', fontSize: '0.68rem', fontWeight: 600 }}>Required</span>}
                      </label>
                      {/* Search Input for District (Bug 4) */}
                      {stateId && role !== 'state_manager' && (
                        <div style={{ position: 'relative', marginBottom: '6px' }}>
                          <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="text"
                            placeholder="Type to filter districts..."
                            value={districtSearch}
                            onChange={(e) => setDistrictSearch(e.target.value)}
                            style={{
                              width: '100%',
                              height: '30px',
                              paddingLeft: '26px',
                              paddingRight: '8px',
                              fontSize: '0.76rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff'
                            }}
                          />
                        </div>
                      )}
                      <select
                        id="reg-district-select"
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem', borderColor: fieldErrors.districtId ? '#ef4444' : undefined }}
                        value={districtId}
                        onChange={(e) => {
                          handleDistrictChange(e.target.value);
                          if (fieldErrors.districtId) setFieldErrors(prev => ({ ...prev, districtId: '' }));
                        }}
                        disabled={!stateId || role === 'state_manager'}
                        required={['district_manager', 'division_manager', 'pincode_manager'].includes(role)}
                      >
                        <option value="">
                          {role === 'state_manager'
                            ? 'N/A (State Level)'
                            : !stateId
                            ? 'Select State First'
                            : searchedDistricts.length === 0
                            ? (districtSearch ? 'No matching districts' : 'No districts available')
                            : 'Select District'}
                        </option>
                        {searchedDistricts.map((d) => {
                          const isFilled = role === 'district_manager' && d.isFull;
                          return (
                            <option
                              key={d._id}
                              value={d._id}
                              disabled={isFilled}
                              style={isFilled ? { color: '#94a3b8', background: '#f8fafc' } : {}}
                            >
                              {d.name} {isFilled ? '⛔ (Place Filled)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {fieldErrors.districtId && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.districtId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Division & PIN Code */}
                  <div className="responsive-grid-2">
                    {/* Division */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Division {['division_manager', 'pincode_manager'].includes(role) ? '*' : ''}</span>
                        {role === 'division_manager' && <span style={{ color: '#8b5cf6', fontSize: '0.68rem', fontWeight: 600 }}>Required</span>}
                      </label>
                      <select
                        id="reg-division-select"
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem', borderColor: fieldErrors.divisionId ? '#ef4444' : undefined }}
                        value={divisionId}
                        onChange={(e) => {
                          handleDivisionChange(e.target.value);
                          if (fieldErrors.divisionId) setFieldErrors(prev => ({ ...prev, divisionId: '' }));
                        }}
                        disabled={!districtId || ['state_manager', 'district_manager'].includes(role)}
                        required={['division_manager', 'pincode_manager'].includes(role)}
                      >
                        <option value="">
                          {['state_manager', 'district_manager'].includes(role)
                            ? 'N/A (Higher Level)'
                            : !districtId
                            ? 'Select District First'
                            : 'Select Division'}
                        </option>
                        {filteredDivisions.map((v) => {
                          const isFilled = role === 'division_manager' && v.isFull;
                          return (
                            <option
                              key={v._id}
                              value={v._id}
                              disabled={isFilled}
                              style={isFilled ? { color: '#94a3b8', background: '#f8fafc' } : {}}
                            >
                              {v.name} {isFilled ? '⛔ (Place Filled)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {fieldErrors.divisionId && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.divisionId}
                        </p>
                      )}
                    </div>

                    {/* PIN Code */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>PIN Code {role === 'pincode_manager' ? '*' : ''}</span>
                        {role === 'pincode_manager' && <span style={{ color: '#10b981', fontSize: '0.68rem', fontWeight: 600 }}>Required</span>}
                      </label>
                      <select
                        id="reg-pincode-select"
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem', borderColor: fieldErrors.pincodeId ? '#ef4444' : undefined }}
                        value={pincodeId}
                        onChange={(e) => {
                          setPincodeId(e.target.value);
                          if (fieldErrors.pincodeId) setFieldErrors(prev => ({ ...prev, pincodeId: '' }));
                        }}
                        disabled={!divisionId || role !== 'pincode_manager'}
                        required={role === 'pincode_manager'}
                      >
                        <option value="">
                          {role !== 'pincode_manager'
                            ? 'N/A (Higher Level)'
                            : !divisionId
                            ? 'Select Division First'
                            : 'Select PIN Code'}
                        </option>
                        {filteredPincodes.map((p) => (
                          <option
                            key={p._id}
                            value={p._id}
                          >
                            {p.code} - {p.areaName}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.pincodeId && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {fieldErrors.pincodeId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Scope Preview */}
                  <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                      Jurisdiction Scope Preview
                    </label>
                    <div style={{
                      height: '38px',
                      padding: '0 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {(() => {
                        const st = states.find(s => (s._id || s.id) === stateId)?.name;
                        const dt = filteredDistricts.find(d => (d._id || d.id) === districtId)?.name;
                        const dv = filteredDivisions.find(v => (v._id || v.id) === divisionId)?.name;
                        const pin = filteredPincodes.find(p => (p._id || p.id) === pincodeId)?.code;
                        const parts = [st, dt, dv, pin ? `PIN ${pin}` : null].filter(Boolean);
                        return parts.length > 0 ? parts.join(' › ') : 'Select location above';
                      })()}
                    </div>
                  </div>

                  {fieldErrors.jurisdiction && (
                    <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', color: '#991b1b', fontSize: '0.74rem' }}>
                      {fieldErrors.jurisdiction}
                    </div>
                  )}

                  {/* Vacancy Status / Exclusivity Notice */}
                  {capacityInfo && capacityInfo.isFull && role !== 'pincode_manager' ? (
                    <div style={{
                      padding: '8px 12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 'var(--radius-sm)',
                      color: '#991b1b',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Registration Not Allowed:</strong> Selected jurisdiction is currently full. Please select an alternate region.
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      padding: '8px 12px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 'var(--radius-sm)',
                      color: '#166534',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span>
                        Dual-phase vacancy check active. Assigned jurisdiction locked upon regional administrator approval.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ----------------- STEP 4: MANDATORY KYC DOCUMENTS ----------------- */}
            {currentStep === 4 && (
              <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={18} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                      4. Mandatory KYC Document Uploads & Digital Signature
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Govt ID Proofs & Payout Authorization (PDF, JPG, PNG &bull; Max 5MB)
                  </span>
                </div>

                <div className="card-body" style={{ padding: '18px' }}>
                  <div className="responsive-grid-4">
                    {/* 1. Aadhaar Card Upload */}
                    <div style={{
                      border: aadharFile ? '1.5px solid #10b981' : (fieldErrors.aadharFile || fieldErrors.aadharNumber ? '1.5px solid #ef4444' : '1px solid var(--border-normal)'),
                      background: aadharFile ? '#f0fdf4' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: aadharFile ? '#dcfce7' : '#f0f9ff',
                            color: aadharFile ? '#15803d' : '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileText size={15} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                            Aadhaar Card <span style={{ color: '#ef4444' }}>*</span>
                          </span>
                        </div>
                        {aadharFile && (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Check size={10} /> Attached
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Govt Identification Proof (Front & Back)
                      </div>

                      {aadharPreview && aadharPreview.startsWith('blob:') && (
                        <div style={{ width: '100%', height: '52px', borderRadius: '4px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={aadharPreview} alt="Aadhaar" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}

                      {aadharFile && (
                        <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📄 {aadharFile.name}
                        </div>
                      )}

                      {/* Aadhaar Number Input */}
                      <div style={{ margin: '4px 0' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                          Aadhaar Number (12 Digits) *
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          placeholder="12-digit Aadhaar"
                          value={aadharNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setAadharNumber(val);
                            if (aadharError && val.length === 12) setAadharError('');
                            if (fieldErrors.aadharNumber && val.length === 12) setFieldErrors(prev => ({ ...prev, aadharNumber: '' }));
                          }}
                          onBlur={() => {
                            const err = validateAadhaar(aadharNumber, true);
                            setFieldErrors(prev => ({ ...prev, aadharNumber: err || '' }));
                          }}
                          style={{
                            width: '100%',
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            border: (aadharError || fieldErrors.aadharNumber) ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontWeight: 600,
                            letterSpacing: '0.5px'
                          }}
                        />
                        {(aadharError || fieldErrors.aadharNumber) && (
                          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                            {aadharError || fieldErrors.aadharNumber}
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                        <label style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: aadharFile ? '#ffffff' : 'var(--primary)',
                          color: aadharFile ? '#334155' : '#ffffff',
                          border: aadharFile ? '1px solid #cbd5e1' : 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          <Upload size={11} /> {aadharFile ? 'Change' : 'Upload Aadhaar'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => {
                            handleDocSelect('aadhar', e);
                            if (fieldErrors.aadharFile) setFieldErrors(prev => ({ ...prev, aadharFile: '' }));
                          }} />
                        </label>
                        {aadharFile && (
                          <button type="button" onClick={() => handleRemoveDoc('aadhar')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {fieldErrors.aadharFile && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {fieldErrors.aadharFile}
                        </span>
                      )}
                    </div>

                    {/* 2. PAN Card Upload */}
                    <div style={{
                      border: panFile ? '1.5px solid #10b981' : (fieldErrors.panFile || fieldErrors.panNumber ? '1.5px solid #ef4444' : '1px solid var(--border-normal)'),
                      background: panFile ? '#f0fdf4' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: panFile ? '#dcfce7' : '#fffbeb',
                            color: panFile ? '#15803d' : '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CreditCard size={15} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                            PAN Card <span style={{ color: '#ef4444' }}>*</span>
                          </span>
                        </div>
                        {panFile && (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Check size={10} /> Attached
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Permanent Account Number (Tax ID)
                      </div>

                      {panPreview && panPreview.startsWith('blob:') && (
                        <div style={{ width: '100%', height: '52px', borderRadius: '4px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={panPreview} alt="PAN" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}

                      {panFile && (
                        <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📄 {panFile.name}
                        </div>
                      )}

                      {/* PAN Number Input */}
                      <div style={{ margin: '4px 0' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                          PAN Number (e.g. ABCDE1234F) *
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="10-character PAN"
                          value={panNumber}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                            setPanNumber(val);
                            if (panError && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) setPanError('');
                            if (fieldErrors.panNumber && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) setFieldErrors(prev => ({ ...prev, panNumber: '' }));
                          }}
                          onBlur={() => {
                            const err = validatePan(panNumber, true);
                            setFieldErrors(prev => ({ ...prev, panNumber: err || '' }));
                          }}
                          style={{
                            width: '100%',
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            border: (panError || fieldErrors.panNumber) ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                          }}
                        />
                        {(panError || fieldErrors.panNumber) && (
                          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                            {panError || fieldErrors.panNumber}
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                        <label style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: panFile ? '#ffffff' : 'var(--primary)',
                          color: panFile ? '#334155' : '#ffffff',
                          border: panFile ? '1px solid #cbd5e1' : 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          <Upload size={11} /> {panFile ? 'Change' : 'Upload PAN'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => {
                            handleDocSelect('pan', e);
                            if (fieldErrors.panFile) setFieldErrors(prev => ({ ...prev, panFile: '' }));
                          }} />
                        </label>
                        {panFile && (
                          <button type="button" onClick={() => handleRemoveDoc('pan')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {fieldErrors.panFile && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {fieldErrors.panFile}
                        </span>
                      )}
                    </div>

                    {/* 3. Bank Passbook / Cheque */}
                    <div style={{
                      border: bankFile ? '1.5px solid #10b981' : (fieldErrors.bankFile ? '1.5px solid #ef4444' : '1px solid var(--border-normal)'),
                      background: bankFile ? '#f0fdf4' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: bankFile ? '#dcfce7' : '#ecfdf5',
                            color: bankFile ? '#15803d' : '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Building size={15} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                            Bank Passbook <span style={{ color: '#ef4444' }}>*</span>
                          </span>
                        </div>
                        {bankFile && (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Check size={10} /> Attached
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Cancelled Cheque / Passbook Copy
                      </div>

                      {bankPreview && bankPreview.startsWith('blob:') && (
                        <div style={{ width: '100%', height: '52px', borderRadius: '4px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={bankPreview} alt="Bank" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}

                      {bankFile && (
                        <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📄 {bankFile.name}
                        </div>
                      )}

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                        <label style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: bankFile ? '#ffffff' : 'var(--primary)',
                          color: bankFile ? '#334155' : '#ffffff',
                          border: bankFile ? '1px solid #cbd5e1' : 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          <Upload size={11} /> {bankFile ? 'Change' : 'Upload Passbook'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => {
                            handleDocSelect('bank', e);
                            if (fieldErrors.bankFile) setFieldErrors(prev => ({ ...prev, bankFile: '' }));
                          }} />
                        </label>
                        {bankFile && (
                          <button type="button" onClick={() => handleRemoveDoc('bank')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {fieldErrors.bankFile && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {fieldErrors.bankFile}
                        </span>
                      )}
                    </div>

                    {/* 4. Digital Signature */}
                    <div style={{
                      border: signatureFile ? '1.5px solid #10b981' : (fieldErrors.signatureFile ? '1.5px solid #ef4444' : '1px solid var(--border-normal)'),
                      background: signatureFile ? '#f0fdf4' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: signatureFile ? '#dcfce7' : '#f5f3ff',
                            color: signatureFile ? '#15803d' : '#8b5cf6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <PenTool size={15} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                            Digital Signature <span style={{ color: '#ef4444' }}>*</span>
                          </span>
                        </div>
                        {signatureFile && (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Check size={10} /> Attached
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        Authorized Signature Specimen
                      </div>

                      {signaturePreview && signaturePreview.startsWith('blob:') && (
                        <div style={{ width: '100%', height: '52px', borderRadius: '4px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={signaturePreview} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}

                      {signatureFile && (
                        <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📄 {signatureFile.name}
                        </div>
                      )}

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                        <label style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: signatureFile ? '#ffffff' : 'var(--primary)',
                          color: signatureFile ? '#334155' : '#ffffff',
                          border: signatureFile ? '1px solid #cbd5e1' : 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}>
                          <Upload size={11} /> {signatureFile ? 'Change' : 'Upload Signature'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => {
                            handleDocSelect('signature', e);
                            if (fieldErrors.signatureFile) setFieldErrors(prev => ({ ...prev, signatureFile: '' }));
                          }} />
                        </label>
                        {signatureFile && (
                          <button type="button" onClick={() => handleRemoveDoc('signature')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {fieldErrors.signatureFile && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {fieldErrors.signatureFile}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 5: BANK DETAILS ----------------- */}
            {currentStep === 5 && (
              <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={15} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>5. Bank Details</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Required for commission & incentive payments</div>
                  </div>
                </div>

                <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Row 1: Account Holder Name & Bank Name */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Account Holder Name *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <User size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-holder-name"
                          type="text"
                          className="form-input"
                          placeholder="As per bank records"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: (bankErrors.accountHolderName || fieldErrors.accountHolderName) ? '#ef4444' : undefined }}
                          value={bankDetails.accountHolderName}
                          onChange={(e) => {
                            setBankDetails(prev => ({ ...prev, accountHolderName: formatName(e.target.value) }));
                            if (bankErrors.accountHolderName) setBankErrors(prev => ({ ...prev, accountHolderName: '' }));
                            if (fieldErrors.accountHolderName) setFieldErrors(prev => ({ ...prev, accountHolderName: '' }));
                          }}
                          onBlur={() => {
                            const err = validateName(bankDetails.accountHolderName, true, 'Account Holder Name');
                            setFieldErrors(prev => ({ ...prev, accountHolderName: err || '' }));
                          }}
                          maxLength={100}
                        />
                      </div>
                      {(bankErrors.accountHolderName || fieldErrors.accountHolderName) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.accountHolderName || fieldErrors.accountHolderName}
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Bank Name *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Landmark size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-name"
                          type="text"
                          className="form-input"
                          placeholder="e.g. State Bank of India"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: (bankErrors.bankName || fieldErrors.bankName) ? '#ef4444' : undefined }}
                          value={bankDetails.bankName}
                          onChange={(e) => {
                            setBankDetails(prev => ({ ...prev, bankName: e.target.value }));
                            if (bankErrors.bankName) setBankErrors(prev => ({ ...prev, bankName: '' }));
                            if (fieldErrors.bankName) setFieldErrors(prev => ({ ...prev, bankName: '' }));
                          }}
                          onBlur={() => {
                            if (!bankDetails.bankName.trim()) {
                              setFieldErrors(prev => ({ ...prev, bankName: 'Bank Name is required.' }));
                            }
                          }}
                          maxLength={100}
                        />
                      </div>
                      {(bankErrors.bankName || fieldErrors.bankName) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.bankName || fieldErrors.bankName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Bank Branch & Bank City */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Bank Branch *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <MapPin size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-branch"
                          type="text"
                          className="form-input"
                          placeholder="Branch name or location"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: (bankErrors.branchName || fieldErrors.branchName) ? '#ef4444' : undefined }}
                          value={bankDetails.branchName}
                          onChange={(e) => {
                            setBankDetails(prev => ({ ...prev, branchName: e.target.value }));
                            if (bankErrors.branchName) setBankErrors(prev => ({ ...prev, branchName: '' }));
                            if (fieldErrors.branchName) setFieldErrors(prev => ({ ...prev, branchName: '' }));
                          }}
                          onBlur={() => {
                            if (!bankDetails.branchName.trim()) {
                              setFieldErrors(prev => ({ ...prev, branchName: 'Bank Branch is required.' }));
                            }
                          }}
                          maxLength={100}
                        />
                      </div>
                      {(bankErrors.branchName || fieldErrors.branchName) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.branchName || fieldErrors.branchName}
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Bank City *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Building size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-city"
                          type="text"
                          className="form-input"
                          placeholder="City where branch is located"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: (bankErrors.city || fieldErrors.city) ? '#ef4444' : undefined }}
                          value={bankDetails.city}
                          onChange={(e) => {
                            setBankDetails(prev => ({ ...prev, city: e.target.value }));
                            if (bankErrors.city) setBankErrors(prev => ({ ...prev, city: '' }));
                            if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: '' }));
                          }}
                          onBlur={() => {
                            if (!bankDetails.city.trim()) {
                              setFieldErrors(prev => ({ ...prev, city: 'Bank City is required.' }));
                            }
                          }}
                          maxLength={80}
                        />
                      </div>
                      {(bankErrors.city || fieldErrors.city) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.city || fieldErrors.city}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Bank Street Address (optional) */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bank Street / Address</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Optional</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Home size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        id="reg-bank-street"
                        type="text"
                        className="form-input"
                        placeholder="Street address of the bank branch (optional)"
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem' }}
                        value={bankDetails.street}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, street: e.target.value }))}
                        maxLength={200}
                      />
                    </div>
                  </div>

                  {/* Row 4: Account Number & IFSC Code */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Account Number *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Banknote size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-account-number"
                          type="text"
                          className="form-input"
                          placeholder="9–18 digit account number"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', letterSpacing: '0.05em', borderColor: (bankErrors.accountNumber || fieldErrors.accountNumber) ? '#ef4444' : undefined }}
                          value={bankDetails.accountNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                            setBankDetails(prev => ({ ...prev, accountNumber: val }));
                            if (bankErrors.accountNumber) setBankErrors(prev => ({ ...prev, accountNumber: '' }));
                            if (fieldErrors.accountNumber) setFieldErrors(prev => ({ ...prev, accountNumber: '' }));
                          }}
                          onBlur={() => {
                            const err = validateAccountNumber(bankDetails.accountNumber, true, bankDetails.bankName);
                            setFieldErrors(prev => ({ ...prev, accountNumber: err || '' }));
                          }}
                          inputMode="numeric"
                          maxLength={18}
                        />
                      </div>
                      {(bankErrors.accountNumber || fieldErrors.accountNumber) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.accountNumber || fieldErrors.accountNumber}
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        IFSC Code *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Hash size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                          id="reg-bank-ifsc"
                          type="text"
                          className="form-input"
                          placeholder="e.g. SBIN0001234"
                          style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', borderColor: (bankErrors.ifscCode || fieldErrors.ifscCode) ? '#ef4444' : undefined }}
                          value={bankDetails.ifscCode}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                            setBankDetails(prev => ({ ...prev, ifscCode: val }));
                            if (bankErrors.ifscCode) setBankErrors(prev => ({ ...prev, ifscCode: '' }));
                            if (fieldErrors.ifscCode) setFieldErrors(prev => ({ ...prev, ifscCode: '' }));
                          }}
                          onBlur={() => {
                            const err = validateIfsc(bankDetails.ifscCode, true);
                            setFieldErrors(prev => ({ ...prev, ifscCode: err || '' }));
                          }}
                          maxLength={11}
                        />
                      </div>
                      {(bankErrors.ifscCode || fieldErrors.ifscCode) && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>
                          {bankErrors.ifscCode || fieldErrors.ifscCode}
                        </div>
                      )}
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Format: 4 letters + 0 + 6 alphanumeric</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 6: APPLICATION REVIEW & SUBMISSION ----------------- */}
            {currentStep === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
                  <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                        6. Review Application & Final Undertaking
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Carefully verify all submitted details
                    </span>
                  </div>

                  <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Summary Section 1: Role & Personal */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {/* Role Card */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>MANAGER ROLE LEVEL</div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginTop: '2px' }}>
                          {ROLES.find(r => r.key === role)?.label}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                          {ROLES.find(r => r.key === role)?.scopeDesc}
                        </div>
                      </div>

                      {/* Personal Details */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>PERSONAL DETAILS</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginTop: '2px' }}>
                          {name} ({gender ? gender.toUpperCase() : 'N/A'})
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                          Email: {email} &bull; Mobile: +91 {mobile}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                          DOB: {dob || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    {/* Summary Section 2: Address & Jurisdiction */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {/* Residential Address */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RESIDENTIAL / OPERATIONAL ADDRESS</div>
                        <div style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 600, marginTop: '4px', lineHeight: 1.45 }}>
                          {[
                            addressFields.doorNumberStreet,
                            addressFields.villageTown,
                            addressFields.postOffice ? `PO: ${addressFields.postOffice}` : null,
                            addressFields.taluk ? `Taluk: ${addressFields.taluk}` : null,
                            addressFields.district,
                            addressFields.state,
                            `PIN: ${addressFields.pincode}`
                          ].filter(Boolean).join(', ')}
                        </div>
                      </div>

                      {/* Assigned Jurisdiction */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>ASSIGNED JURISDICTION SCOPE</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                          {(() => {
                            const st = states.find(s => (s._id || s.id) === stateId)?.name;
                            const dt = filteredDistricts.find(d => (d._id || d.id) === districtId)?.name;
                            const dv = filteredDivisions.find(v => (v._id || v.id) === divisionId)?.name;
                            const pin = filteredPincodes.find(p => (p._id || p.id) === pincodeId)?.code;
                            const parts = [st, dt, dv, pin ? `PIN ${pin}` : null].filter(Boolean);
                            return parts.length > 0 ? parts.join(' › ') : 'Not selected';
                          })()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
                          Status: Regional Vacancy Verified
                        </div>
                      </div>
                    </div>

                    {/* Summary Section 3: KYC Documents & Bank Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {/* Documents Status */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>KYC VERIFICATION DOCUMENTS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '0.76rem', color: '#334155' }}>
                          <div>• Aadhaar: <strong>{maskAadhaar(aadharNumber)}</strong> {aadharFile ? `(📄 ${aadharFile.name})` : '⚠️ Missing'}</div>
                          <div>• PAN Card: <strong>{maskPan(panNumber)}</strong> {panFile ? `(📄 ${panFile.name})` : '⚠️ Missing'}</div>
                          <div>• Bank Passbook: {bankFile ? `(📄 ${bankFile.name})` : '⚠️ Missing'}</div>
                          <div>• Digital Signature: {signatureFile ? `(📄 ${signatureFile.name})` : '⚠️ Missing'}</div>
                        </div>
                      </div>

                      {/* Bank Details */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>COMMISSION & PAYOUT BANK ACCOUNT</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginTop: '2px' }}>
                          {bankDetails.accountHolderName} &bull; {bankDetails.bankName}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                          Account: <strong>••••••••{bankDetails.accountNumber.slice(-4)}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                          IFSC: {bankDetails.ifscCode} &bull; Branch: {bankDetails.branchName}, {bankDetails.city}
                        </div>
                      </div>
                    </div>

                    {/* Official Undertaking Checkbox */}
                    <div style={{ marginTop: '6px', padding: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          id="reg-declaration-checkbox"
                          checked={declarationAccepted}
                          onChange={(e) => {
                            setDeclarationAccepted(e.target.checked);
                            if (fieldErrors.declaration) setFieldErrors(prev => ({ ...prev, declaration: '' }));
                          }}
                          style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.45 }}>
                          <strong>Official Undertaking & Declaration:</strong> I hereby declare that all personal details (DOB, Gender, Residential Address) and uploaded KYC documents (Aadhaar, PAN, Bank Passbook, and Digital Signature) provided in this registration are genuine, authentic, and legally accurate. I agree to adhere to the Forge India Connect Code of Conduct and regional operating guidelines.
                        </span>
                      </label>
                      {fieldErrors.declaration && (
                        <p style={{ margin: '8px 0 0 30px', fontSize: '0.74rem', color: '#ef4444', fontWeight: 700 }}>
                          {fieldErrors.declaration}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP NAVIGATION BAR (Bug 3) ----------------- */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-normal)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setCurrentStep(prev => prev - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 700 }}
                >
                  <ArrowLeft size={15} /> Previous Step
                </button>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sign In to Dashboard
                  </button>
                </div>
              )}

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={() => handleNextStep(currentStep)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 22px', fontWeight: 700 }}
                >
                  Next: {STEP_TITLES[currentStep]} <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || isSubmitting || !declarationAccepted || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')}
                  className="btn btn-primary"
                  style={{
                    minWidth: '240px',
                    padding: '11px 24px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: (!declarationAccepted || isSubmitting || loading || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')) ? '#94a3b8' : undefined,
                    cursor: (!declarationAccepted || isSubmitting || loading || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading || isSubmitting ? (
                    'Submitting Application...'
                  ) : (
                    <>
                      Submit Application <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}

        {/* ----------------- STAGE 1: UNDER REVIEW (AWAITING APPROVAL) ----------------- */}
        {flowState === 'under_review' && registeredUser && (
          <div className="register-columns-grid">
            {/* Left Card: Registered Application Details */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} style={{ color: 'var(--forge-gold)' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    Registered Application & Profile Details
                  </h3>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Level {registeredUser.level}
                </span>
              </div>

              <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div className="responsive-grid-2" style={{ fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Full Name:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{registeredUser.name}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Assigned Role:</span>
                    <div style={{ fontWeight: 700, color: '#6366f1' }}>
                      {registeredUser.role.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Email:</span>
                    <div style={{ color: '#0f172a' }}>{registeredUser.email}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Mobile:</span>
                    <div style={{ color: '#0f172a' }}>+91 {registeredUser.mobile}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Date of Birth:</span>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>{registeredUser.dob || 'Provided'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Gender:</span>
                    <div style={{ color: '#0f172a', fontWeight: 600, textTransform: 'capitalize' }}>{registeredUser.gender || 'Male'}</div>
                  </div>
                </div>

                {(registeredUser.residentialAddress || registeredUser.address) && (
                  <div style={{ fontSize: '0.82rem', padding: '10px 12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Residential Address:</span>
                    <div style={{ color: '#334155', marginTop: '2px', fontWeight: 500 }}>
                      {typeof registeredUser.residentialAddress === 'object' && registeredUser.residentialAddress
                        ? [
                            registeredUser.residentialAddress.doorNumberStreet,
                            registeredUser.residentialAddress.villageTown,
                            registeredUser.residentialAddress.postOffice ? `PO: ${registeredUser.residentialAddress.postOffice}` : '',
                            registeredUser.residentialAddress.taluk ? `Taluk: ${registeredUser.residentialAddress.taluk}` : '',
                            registeredUser.residentialAddress.district,
                            registeredUser.residentialAddress.state,
                            registeredUser.residentialAddress.pincode ? `PIN: ${registeredUser.residentialAddress.pincode}` : ''
                          ].filter(Boolean).join(', ')
                        : (typeof registeredUser.address === 'object' && registeredUser.address
                            ? Object.values(registeredUser.address).filter(v => typeof v === 'string' && v.trim()).join(', ')
                            : registeredUser.address)}
                    </div>
                  </div>
                )}

                {/* KYC Documents Checklist */}
                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Uploaded KYC Verification Files & Govt IDs
                  </div>
                  <div className="responsive-grid-2" style={{ gap: '8px', fontSize: '0.76rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                      <FileCheck size={13} style={{ color: '#6366f1' }} />
                      <span>Aadhaar: <strong>{maskAadhaar(registeredUser.aadharNumber || registeredUser.documents?.aadharNumber) || 'Attached'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                      <FileCheck size={13} style={{ color: '#6366f1' }} />
                      <span>PAN: <strong>{maskPan(registeredUser.panNumber || registeredUser.documents?.panNumber) || 'Attached'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                      <FileCheck size={13} style={{ color: '#6366f1' }} /> Bank Passbook
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                      <FileCheck size={13} style={{ color: '#6366f1' }} /> Digital Signature
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Assigned Geographic Jurisdiction
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                    {[
                      registeredUser.scope?.stateName,
                      registeredUser.scope?.districtName,
                      registeredUser.scope?.divisionName,
                      registeredUser.scope?.pincodeCode ? `PIN ${registeredUser.scope.pincodeCode}` : null
                    ].filter(Boolean).join(' › ')}
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '10px', fontSize: '0.84rem', fontWeight: 600 }}
                    onClick={() => onNavigate('login')}
                  >
                    <ArrowLeft size={14} /> Return to Sign In
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Stage 1 Status & Pipeline Tracking */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: '#f59e0b' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    Regional Authorization Status
                  </h3>
                </div>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: isMainAdminApproved ? '#dcfce7' : isSubAdminApproved ? '#dbeafe' : '#fef3c7',
                  color: isMainAdminApproved ? '#15803d' : isSubAdminApproved ? '#1e40af' : '#b45309',
                  border: isMainAdminApproved ? '1px solid #bbf7d0' : isSubAdminApproved ? '1px solid #bfdbfe' : '1px solid #fde68a'
                }}>
                  {isMainAdminApproved ? 'Main Admin Approved • KYC Pending' : isSubAdminApproved ? 'Sub-Admin Approved • Waiting Main Admin' : 'Pending Sub-Admin Approval'}
                </span>
              </div>

              <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                {/* Onboarding Pipeline Tracker */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Authorization Pipeline
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 1. Registration Submitted</span>
                      <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Done</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: isSubAdminApproved ? '#15803d' : '#b45309', fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isSubAdminApproved ? <CheckCircle2 size={14} /> : <Clock size={14} />} 2. Territorial Sub-admin Review
                      </span>
                      <span style={{ fontSize: '0.7rem', background: isSubAdminApproved ? '#dcfce7' : '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                        {isSubAdminApproved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: isMainAdminApproved ? '#15803d' : isSubAdminApproved ? '#b45309' : '#94a3b8', fontWeight: isSubAdminApproved ? 700 : 500 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isMainAdminApproved ? <CheckCircle2 size={14} /> : isSubAdminApproved ? <Clock size={14} /> : <Lock size={14} />} 3. Main Admin Approval
                      </span>
                      <span style={{ fontSize: '0.7rem', background: isMainAdminApproved ? '#dcfce7' : isSubAdminApproved ? '#fef3c7' : '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                        {isMainAdminApproved ? 'Approved' : isSubAdminApproved ? 'Pending' : 'Waiting Sub-admin'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Lock size={14} /> 4. KYC Document Clearance</span>
                      <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>Locked</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Lock size={14} /> 5. Dashboard Portal Access</span>
                      <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>Locked</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  background: isSubAdminApproved ? '#eff6ff' : '#fffbeb',
                  border: isSubAdminApproved ? '1px solid #bfdbfe' : '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isSubAdminApproved ? '#3b82f6' : '#f59e0b',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    {isSubAdminApproved ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: isSubAdminApproved ? '#1e40af' : '#92400e', margin: '0 0 4px 0' }}>
                    {isMainAdminApproved ? 'Awaiting KYC Verification' : isSubAdminApproved ? 'Awaiting Main Admin Authorization' : 'Awaiting Sub-Admin Approval'}
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: isSubAdminApproved ? '#1e3a8a' : '#b45309', margin: 0, lineHeight: 1.45 }}>
                    {isMainAdminApproved
                      ? 'Main Admin authorization granted! Your application is now in the KYC document clearance queue.'
                      : isSubAdminApproved
                        ? 'Territorial Sub-admin review is approved! Your application is now in the Main Admin authorization queue.'
                        : (registeredUser.assignedSubAdminName 
                            ? `Your registration is queued with Sub-admin (${registeredUser.assignedSubAdminName}) for territorial approval.`
                            : 'Your registration is queued in the Sub-admin approval queue awaiting territorial assignment.')}
                    {' '}Dashboard access is strictly locked until all approvals and KYC verification are completed.
                  </p>
                </div>

                {/* Live Authorization Status Tracking Card */}
                <div style={{
                  marginTop: 'auto',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '6px'
                  }}>
                    <Clock size={15} style={{ color: '#f59e0b' }} /> Official Review In Progress
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.45 }}>
                    Your application is being evaluated in accordance with territorial jurisdiction rules. You will receive access once all administrative reviews and KYC verification are cleared.
                  </p>

                  <button
                    type="button"
                    onClick={handleRefreshStatus}
                    disabled={refreshingStatus}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}
                  >
                    <RefreshCw size={15} className={refreshingStatus ? 'animate-spin' : ''} />
                    {refreshingStatus ? 'Checking Status...' : 'Check / Refresh Status'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <ArrowLeft size={13} /> Back to Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- STAGE 2: KYC PENDING ----------------- */}
        {flowState === 'kyc_pending' && registeredUser && (
          <div className="register-columns-grid">
            {/* Left Card: Registered Application Details */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} style={{ color: 'var(--forge-gold)' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    Registered Application & Profile Details
                  </h3>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Level {registeredUser.level}
                </span>
              </div>

              <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div className="responsive-grid-2" style={{ gap: '12px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Full Name:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{registeredUser.name}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Assigned Role:</span>
                    <div style={{ fontWeight: 700, color: '#6366f1' }}>
                      {registeredUser.role.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Email:</span>
                    <div style={{ color: '#0f172a' }}>{registeredUser.email}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Mobile:</span>
                    <div style={{ color: '#0f172a' }}>+91 {registeredUser.mobile}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Date of Birth:</span>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>{registeredUser.dob || 'Provided'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>Admin Approval:</span>
                    <div style={{ color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} /> Granted
                    </div>
                  </div>
                </div>

                {/* KYC Documents Checklist */}
                <div style={{
                  padding: '12px',
                  background: '#f0f9ff',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    KYC Documents Awaiting Compliance Clearance
                  </div>
                  <div className="responsive-grid-2" style={{ gap: '8px', fontSize: '0.76rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 600 }}>
                      <FileText size={13} />
                      <span>Aadhaar: {maskAadhaar(registeredUser.aadharNumber || registeredUser.documents?.aadharNumber) || 'Pending'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 600 }}>
                      <FileText size={13} />
                      <span>PAN: {maskPan(registeredUser.panNumber || registeredUser.documents?.panNumber) || 'Pending'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 600 }}>
                      <FileText size={13} /> Bank Passbook (Pending)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 600 }}>
                      <FileText size={13} /> Digital Signature (Pending)
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Assigned Geographic Jurisdiction
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                    {[
                      registeredUser.scope?.stateName,
                      registeredUser.scope?.districtName,
                      registeredUser.scope?.divisionName,
                      registeredUser.scope?.pincodeCode ? `PIN ${registeredUser.scope.pincodeCode}` : null
                    ].filter(Boolean).join(' › ')}
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '10px', fontSize: '0.84rem', fontWeight: 600 }}
                    onClick={() => onNavigate('login')}
                  >
                    <ArrowLeft size={14} /> Return to Sign In
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Stage 2 Status & Compliance Tracking */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
              <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={16} style={{ color: '#0284c7' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    KYC Compliance Status
                  </h3>
                </div>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bae6fd'
                }}>
                  KYC Pending
                </span>
              </div>

              <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                {/* Onboarding Pipeline Tracker */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Authorization Pipeline
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 1. Registration Submitted</span>
                      <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Done</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 2. Territorial Sub-admin Review</span>
                      <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Approved</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 3. Main Admin Approval</span>
                      <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Approved</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0284c7', fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> 4. KYC Document Verification</span>
                      <span style={{ fontSize: '0.7rem', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>Pending</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Lock size={14} /> 5. Portal Access Activated</span>
                      <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>Locked</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#0284c7',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Shield size={22} />
                  </div>
                  <h4 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0369a1', margin: '0 0 4px 0' }}>
                    Admins Approved &bull; KYC In Progress
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: '#0284c7', margin: 0, lineHeight: 1.45 }}>
                    Both Sub-admin and Main Admin have approved your manager registration! The KYC Compliance team is now conducting verification of your Aadhaar, PAN, Bank Passbook, and Digital Signature.
                  </p>
                </div>

                {/* Live KYC Status Tracking Card */}
                <div style={{
                  marginTop: 'auto',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#0369a1',
                    marginBottom: '6px'
                  }}>
                    <Shield size={15} style={{ color: '#0284c7' }} /> KYC Compliance Clearance In Progress
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.45 }}>
                    The KYC Verification team is evaluating your uploaded identity documents. Once verified, your manager account will be immediately activated.
                  </p>

                  <button
                    type="button"
                    onClick={handleRefreshStatus}
                    disabled={refreshingStatus}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}
                  >
                    <RefreshCw size={15} className={refreshingStatus ? 'animate-spin' : ''} />
                    {refreshingStatus ? 'Checking Status...' : 'Check / Refresh KYC Status'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <ArrowLeft size={13} /> Back to Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- STAGE 3: APPROVED, KYC VERIFIED & ACTIVATED ----------------- */}
        {flowState === 'approved' && registeredUser && (
          <div className="register-columns-grid">
            {/* Left Card: Congratulations & Authorized Profile */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', textAlign: 'center', padding: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                border: '2px solid #86efac'
              }}>
                <CheckCircle2 size={32} />
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Manager Profile Approved & KYC Verified!
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px 0' }}>
                Congratulations, <strong>{registeredUser.name}</strong>! Your manager credentials have been authorized, KYC documents verified, and jurisdiction allocation is locked.
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                fontSize: '0.8rem',
                textAlign: 'left',
                marginTop: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Role Level:</span>
                  <span style={{ fontWeight: 700, color: '#6366f1' }}>Level {registeredUser.level} - {registeredUser.role.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Admin Approval:</span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>✓ Approved by Administrator</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>KYC Verification:</span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>✓ Verified (Aadhaar, PAN, Bank, Signature)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Authorized ID:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{registeredUser.id?.slice(-8).toUpperCase() || 'MGR-ACTIVE'}</span>
                </div>
              </div>
            </div>

            {/* Right Card: Jurisdiction Scope & Activation Action */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', padding: '24px' }}>
              <div className="card-header" style={{ padding: '0 0 12px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} style={{ color: '#10b981' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    Active Jurisdiction Allocation
                  </h3>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac'
                }}>
                  Capacity Reserved
                </span>
              </div>

              {/* Onboarding Pipeline Tracker (Completed) */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '0.78rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Pipeline Completed
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 1. Registration Submitted</span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Done</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 2. Territorial Sub-admin Review</span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Approved</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 3. Main Admin Authorization</span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Approved</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 4. KYC Document Verification</span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Verified</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 5. Account Activated</span>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>Active</span>
                </div>
              </div>

              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Assigned Region
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#15803d' }}>
                  {[
                    registeredUser.scope?.stateName,
                    registeredUser.scope?.districtName,
                    registeredUser.scope?.divisionName,
                    registeredUser.scope?.pincodeCode ? `PIN ${registeredUser.scope.pincodeCode}` : null
                  ].filter(Boolean).join(' › ')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: '6px' }}>
                  ● Capacity reserved: Another person cannot register for this filled jurisdiction.
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={() => onNavigate('login')}
                >
                  Sign In to Dashboard <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- STAGE REJECTED: SUB-ADMIN OR KYC REJECTED ----------------- */}
        {flowState === 'rejected' && registeredUser && (
          <div className="register-columns-grid">
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', textAlign: 'center', padding: '28px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '2px solid #fca5a5'
              }}>
                <X size={32} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', margin: '0 0 6px 0' }}>
                Manager Registration Not Approved
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Your manager application for <strong>{registeredUser.name}</strong> was reviewed and could not be approved at this time.
              </p>

              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'left',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Reason for Decision
                </div>
                <div style={{ fontSize: '0.88rem', color: '#b91c1c', fontWeight: 600 }}>
                  {rejectionReason || registeredUser.rejectionReason || 'Application documents or territorial allocation did not meet current onboarding criteria.'}
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                fontSize: '0.8rem',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Assigned Level:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{registeredUser.role?.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Dashboard Access:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>Locked (Authorization Restricted)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Contact Support:</span>
                  <span style={{ color: '#475569' }}>Please contact your regional administrator for next steps.</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.88rem', fontWeight: 700 }}
                  onClick={() => onNavigate('login')}
                >
                  <ArrowLeft size={16} /> Return to Sign In
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
