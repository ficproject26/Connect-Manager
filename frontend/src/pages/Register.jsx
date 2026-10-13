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
  RefreshCw
} from 'lucide-react';

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
      if (initialUser.aadharNumber || initialUser.documents?.aadharNumber) {
        setAadharNumber(initialUser.aadharNumber || initialUser.documents?.aadharNumber);
      }
      if (initialUser.panNumber || initialUser.documents?.panNumber) {
        setPanNumber(initialUser.panNumber || initialUser.documents?.panNumber);
      }
    }
  }, [initialUser, initialFlowState, initialToken, initialRejectionReason]);

  // Messages & Loading
  const [loading, setLoading] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  // Full Name formatting and validation:
  // - Only English alphabetic characters (A-Z, a-z) and spaces between name parts
  // - No numbers, special characters, leading spaces
  // - Auto-capitalize first letter of every name part
  const formatAndValidateName = (rawVal) => {
    // Strip leading spaces
    const noLeading = rawVal.replace(/^\s+/, '');
    // Collapse consecutive spaces into a single space
    const singleSpaced = noLeading.replace(/\s{2,}/g, ' ');

    const endsWithSpace = singleSpaced.endsWith(' ');
    const parts = singleSpaced.split(' ');
    const capitalized = parts.map(part => {
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');

    return endsWithSpace && !capitalized.endsWith(' ') ? capitalized + ' ' : capitalized;
  };

  const handleNameChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatAndValidateName(rawVal);
    setName(formatted);

    // Validation while typing
    const trimmed = formatted.trim();
    if (!trimmed) {
      setNameError('');
      return;
    }

    if (/[^a-zA-Z\s]/.test(formatted)) {
      setNameError('Only English alphabetic characters (A–Z, a–z) and spaces between name parts are allowed. Numbers and special characters are not permitted.');
    } else {
      setNameError('');
    }
  };

  const handleNameBlur = () => {
    const trimmed = name.trim();
    setName(trimmed);
    if (!trimmed) {
      setNameError('Full Name is required.');
    } else if (/[^a-zA-Z\s]/.test(trimmed) || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(trimmed)) {
      setNameError('Invalid Full Name. Only English alphabetic characters (A–Z, a–z) and spaces between name parts are allowed.');
    } else if (trimmed.length < 2) {
      setNameError('Full Name must be at least 2 characters long.');
    } else {
      setNameError('');
    }
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

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      setNameError('Full Name must not exceed 50 characters.');
      setError('Full Name must not exceed 50 characters.');
      return;
    }
    const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!trimmedName || !email.trim() || !mobile.trim() || !password) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    if (!nameRegex.test(trimmedName) || trimmedName.length < 2) {
      setNameError('Invalid Full Name. Only English alphabetic characters (A–Z, a–z) and single spaces between name parts are allowed.');
      setError('Full Name is invalid. Numbers, special characters, and extra spaces are not permitted.');
      return;
    }

    if (email.trim().length > 100) {
      setError('Email address must not exceed 100 characters.');
      return;
    }

    if (mobile.trim().length !== 10 || !/^\d{10}$/.test(mobile.trim())) {
      setError('Mobile number must be a valid 10-digit number.');
      return;
    }

    if (!dob) {
      setError('Please select your Date of Birth.');
      return;
    }

    if (!addressFields.doorNumberStreet.trim()) {
      setError('Please enter Door Number / Street Name.');
      return;
    }
    if (!addressFields.villageTown.trim()) {
      setError('Please enter Village / Town Name.');
      return;
    }
    if (!addressFields.postOffice.trim()) {
      setError('Please enter Post Office.');
      return;
    }
    if (!addressFields.taluk.trim()) {
      setError('Please enter Taluk.');
      return;
    }
    if (!addressFields.district.trim()) {
      setError('Please enter District for residential address.');
      return;
    }
    if (!addressFields.state.trim()) {
      setError('Please enter State for residential address.');
      return;
    }
    const cleanAddressPin = addressFields.pincode.trim().replace(/\D/g, '');
    if (!/^[1-9][0-9]{5}$/.test(cleanAddressPin)) {
      setError('Please enter a valid 6-digit Indian PIN Code starting with 1–9.');
      return;
    }

    const cleanAadhar = aadharNumber.trim().replace(/\D/g, '');
    if (!cleanAadhar || cleanAadhar.length !== 12) {
      setAadharError('Aadhaar Number must be exactly 12 digits.');
      setError('Please provide a valid 12-digit Aadhaar Number.');
      return;
    }

    const cleanPan = panNumber.trim().toUpperCase();
    if (!cleanPan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      setPanError('Invalid PAN format (e.g. ABCDE1234F).');
      setError('Please provide a valid 10-character PAN Number (e.g. ABCDE1234F).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    // Role-specific location check
    if (role === 'state_manager' && !stateId) {
      setError('Please select an assigned State for State Manager.');
      return;
    }
    if (role === 'district_manager' && (!stateId || !districtId)) {
      setError('Please select both State and District for District Manager.');
      return;
    }
    if (role === 'division_manager' && (!stateId || !districtId || !divisionId)) {
      setError('Please select State, District, and Division for Division Manager.');
      return;
    }
    if (role === 'pincode_manager' && (!stateId || !districtId || !divisionId || !pincodeId)) {
      setError('Please select State, District, Division, and PIN Code for PIN Code Manager.');
      return;
    }

    if (!declarationAccepted) {
      setError('Please accept the official declaration and operational guidelines before submitting.');
      return;
    }

    // Bank Details validation
    const bdErrors = {};
    if (!bankDetails.accountHolderName.trim()) bdErrors.accountHolderName = 'Account Holder Name is required.';
    if (!bankDetails.bankName.trim()) bdErrors.bankName = 'Bank Name is required.';
    if (!bankDetails.branchName.trim()) bdErrors.branchName = 'Bank Branch is required.';
    if (!bankDetails.city.trim()) bdErrors.city = 'Bank City is required.';
    if (!bankDetails.accountNumber.trim()) {
      bdErrors.accountNumber = 'Account Number is required.';
    } else if (!/^\d{9,18}$/.test(bankDetails.accountNumber.trim().replace(/\s/g, ''))) {
      bdErrors.accountNumber = 'Account Number must be 9–18 digits.';
    }
    if (!bankDetails.ifscCode.trim()) {
      bdErrors.ifscCode = 'IFSC Code is required.';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode.trim().toUpperCase())) {
      bdErrors.ifscCode = 'Invalid IFSC Code format (e.g. SBIN0001234).';
    }
    if (Object.keys(bdErrors).length > 0) {
      setBankErrors(bdErrors);
      setError('Please fill in all required Bank Details correctly.');
      return;
    }
    setBankErrors({});

    // 4 Mandatory KYC Document Uploads Validation
    if (!aadharFile) {
      setError('Please upload your Aadhaar Card document (mandatory).');
      return;
    }
    if (!panFile) {
      setError('Please upload your PAN Card document (mandatory).');
      return;
    }
    if (!bankFile) {
      setError('Please upload your Bank Passbook / Cheque document (mandatory).');
      return;
    }
    if (!signatureFile) {
      setError('Please upload your Digital Signature specimen (mandatory).');
      return;
    }

    if (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager') {
      setError('Capacity reached for this location. Registration not allowed.');
      return;
    }

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
      setLoading(false);
    }
  };

  // Live Registration Status Polling / Refresh
  const handleRefreshStatus = async () => {
    if (!registeredUser?.id) return;
    setRefreshingStatus(true);
    setError('');

    try {
      const res = await authService.getRegistrationStatus(registeredUser.id);
      if (res.success && res.data) {
        const updated = {
          ...registeredUser,
          ...res.data,
          status: res.data.overallRegistrationStatus || res.data.status
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
            {/* Step 1: Horizontal Manager Role Selection Strip */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    1. Select Manager Role Level
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>&bull; Choose your tier</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                  Hierarchy &bull; 4 Tier Architecture
                </span>
              </div>

              <div className="register-role-grid">
                {ROLES.map((r) => {
                  const IconComponent = r.icon;
                  const isSelected = role === r.key;
                  return (
                    <div
                      key={r.key}
                      onClick={() => setRole(r.key)}
                      style={{
                        border: isSelected ? `2px solid ${r.color}` : '1px solid var(--border-normal)',
                        background: isSelected ? r.bg : '#ffffff',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: isSelected ? `0 2px 8px ${r.border}` : 'var(--shadow-xs)'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: isSelected ? r.color : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={18} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.label}
                          </span>
                          {isSelected && (
                            <div style={{
                              background: r.color,
                              color: 'white',
                              borderRadius: '50%',
                              width: '15px',
                              height: '15px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Check size={10} />
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isSelected ? r.color : '#64748b', fontWeight: 600, marginTop: '2px' }}>
                          {r.scopeDesc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Steps 2 & 4: Balanced Side-by-Side 2-Column Grid (Horizontally Aligned) */}
            <div className="register-columns-grid">
              {/* Left Column Card: 2. Personal Information & Credentials */}
              <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                      2. Personal Details & Credentials
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Manager Identity & Access
                  </span>
                </div>

                <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {/* Photo Upload & Full Name (Horizontally Aligned) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
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
                        <Camera size={20} style={{ color: '#94a3b8' }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                      <label style={{
                        padding: '4px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Upload size={11} /> {avatarPreview ? 'Change' : 'Photo'}
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
                            border: nameError ? '1.5px solid #ef4444' : undefined,
                            background: nameError ? '#fff5f5' : undefined
                          }}
                          placeholder="e.g. Ramesh Kumar"
                          value={name}
                          onChange={handleNameChange}
                          onBlur={handleNameBlur}
                        />
                        <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: nameError ? '#ef4444' : '#94a3b8' }} />
                      </div>
                      {nameError && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                          {nameError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email & Mobile (Horizontally Aligned in 2 Columns) */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Official Email *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="email"
                          required
                          maxLength={100}
                          className="form-input"
                          style={{ paddingLeft: '34px', height: '38px', fontSize: '0.84rem' }}
                          placeholder="manager@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        <Mail size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Mobile Number *</label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid var(--border-normal)',
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
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
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
                    </div>
                  </div>

                  {/* Date of Birth & Gender (Horizontally Aligned in 2 Columns) */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Date of Birth (DOB) *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="date"
                          required
                          max="2008-12-31"
                          className="form-input"
                          style={{ paddingLeft: '34px', height: '38px', fontSize: '0.84rem' }}
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                        />
                        <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                      </div>
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

                  {/* Residential / Operational Address (7 Separate Fields) */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      <Home size={14} style={{ color: 'var(--primary, #0ea5e9)' }} />
                      Residential / Operational Address *
                    </div>

                    {/* Field 1: Door Number / Street Name (Full width) */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                        1. Door Number / Street Name *
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="address-line1"
                        className="form-input"
                        style={{ height: '36px', fontSize: '0.82rem' }}
                        placeholder="e.g. Door No. 12/4B, North Car Street"
                        value={addressFields.doorNumberStreet}
                        onChange={(e) => handleAddressChange('doorNumberStreet', e.target.value)}
                      />
                    </div>

                    {/* Row 2: Village/Town & Post Office (2 Columns) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          2. Village / Town Name *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="address-level3"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. Anna Nagar / Mettur"
                          value={addressFields.villageTown}
                          onChange={(e) => handleAddressChange('villageTown', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          3. Post Office *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. Mettur Dam SO"
                          value={addressFields.postOffice}
                          onChange={(e) => handleAddressChange('postOffice', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Row 3: Taluk & District (2 Columns) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          4. Taluk *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. Mettur Taluk"
                          value={addressFields.taluk}
                          onChange={(e) => handleAddressChange('taluk', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          5. District *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="address-level2"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. Salem"
                          value={addressFields.district}
                          onChange={(e) => handleAddressChange('district', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Row 4: State & PIN Code (2 Columns) */}
                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          6. State *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="address-level1"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. Tamil Nadu"
                          value={addressFields.state}
                          onChange={(e) => handleAddressChange('state', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: '#475569' }}>
                          7. PIN Code (6 Digits) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          autoComplete="postal-code"
                          className="form-input"
                          style={{ height: '36px', fontSize: '0.82rem' }}
                          placeholder="e.g. 636401"
                          value={addressFields.pincode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            handleAddressChange('pincode', val);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Passwords (Horizontally Aligned in 2 Columns) */}
                  <div className="responsive-grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>Password *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          className="form-input"
                          style={{ paddingLeft: '34px', paddingRight: '34px', height: '38px', fontSize: '0.84rem' }}
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <Lock size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '9px',
                            top: '10px',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
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
                          style={{ paddingLeft: '34px', paddingRight: '34px', height: '38px', fontSize: '0.84rem' }}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <Lock size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '9px',
                            top: '10px',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <div style={{ fontSize: '0.66rem', marginTop: '4px', fontWeight: 600, color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                          {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column Card: 4. Assigned Geographic Jurisdiction & Allocation */}
              <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} style={{ color: 'var(--forge-gold)' }} />
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                      4. Assigned Jurisdiction & Allocation
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

                <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {/* Row 1: State & District (Horizontally Aligned in 2 Columns) */}
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
                        style={{ height: '38px', fontSize: '0.84rem' }}
                        value={stateId}
                        onChange={(e) => handleStateChange(e.target.value)}
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
                    </div>

                    {/* District */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>District {['district_manager', 'division_manager', 'pincode_manager'].includes(role) ? '*' : ''}</span>
                        {role === 'district_manager' && <span style={{ color: '#0284c7', fontSize: '0.68rem', fontWeight: 600 }}>Required</span>}
                      </label>
                      <select
                        id="reg-district-select"
                        className="form-select"
                        style={{ height: '38px', fontSize: '0.84rem' }}
                        value={districtId}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        disabled={!stateId || role === 'state_manager'}
                        required={['district_manager', 'division_manager', 'pincode_manager'].includes(role)}
                      >
                        <option value="">
                          {role === 'state_manager'
                            ? 'N/A (State Level)'
                            : !stateId
                            ? 'Select State First'
                            : filteredDistricts.length === 0
                            ? 'No districts available'
                            : 'Select District'}
                        </option>
                        {filteredDistricts.map((d) => {
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
                    </div>
                  </div>

                  {/* Row 2: Division & PIN Code (Horizontally Aligned in 2 Columns) */}
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
                        style={{ height: '38px', fontSize: '0.84rem' }}
                        value={divisionId}
                        onChange={(e) => handleDivisionChange(e.target.value)}
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
                        style={{ height: '38px', fontSize: '0.84rem' }}
                        value={pincodeId}
                        onChange={(e) => setPincodeId(e.target.value)}
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
                    </div>
                  </div>

                  {/* Row 3: Jurisdiction Scope Preview (Full Width) */}
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
                      fontSize: '0.75rem',
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
            </div>

            {/* Section 3: Mandatory KYC Document Uploads & Digital Signature (Full Width Card) */}
            <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
              <div className="card-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={16} style={{ color: 'var(--forge-gold)' }} />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>
                    3. Mandatory KYC Document Uploads & Digital Signature
                  </h3>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Govt ID Proofs & Payout Authorization (PDF, JPG, PNG &bull; Max 5MB)
                </span>
              </div>

              <div className="card-body" style={{ padding: '16px 18px' }}>
                <div className="responsive-grid-4">
                  {/* 1. Aadhaar Card Upload */}
                  <div style={{
                    border: aadharFile ? '1.5px solid #10b981' : '1px solid var(--border-normal)',
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

                    {/* Dedicated Aadhaar Number Input */}
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
                        }}
                        onBlur={() => {
                          if (aadharNumber && aadharNumber.length !== 12) {
                            setAadharError('Must be exactly 12 digits');
                          } else {
                            setAadharError('');
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '32px',
                          padding: '0 8px',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: aadharError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontWeight: 600,
                          letterSpacing: '0.5px'
                        }}
                      />
                      {aadharError && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {aadharError}
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
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => handleDocSelect('aadhar', e)} />
                      </label>
                      {aadharFile && (
                        <button type="button" onClick={() => handleRemoveDoc('aadhar')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. PAN Card Upload */}
                  <div style={{
                    border: panFile ? '1.5px solid #10b981' : '1px solid var(--border-normal)',
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

                    {/* Dedicated PAN Number Input */}
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
                        }}
                        onBlur={() => {
                          if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
                            setPanError('Format: ABCDE1234F');
                          } else {
                            setPanError('');
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '32px',
                          padding: '0 8px',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: panError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}
                      />
                      {panError && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          {panError}
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
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => handleDocSelect('pan', e)} />
                      </label>
                      {panFile && (
                        <button type="button" onClick={() => handleRemoveDoc('pan')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Bank Passbook / Cheque */}
                  <div style={{
                    border: bankFile ? '1.5px solid #10b981' : '1px solid var(--border-normal)',
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
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => handleDocSelect('bank', e)} />
                      </label>
                      {bankFile && (
                        <button type="button" onClick={() => handleRemoveDoc('bank')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4. Digital Signature */}
                  <div style={{
                    border: signatureFile ? '1.5px solid #10b981' : '1px solid var(--border-normal)',
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
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={(e) => handleDocSelect('signature', e)} />
                      </label>
                      {signatureFile && (
                        <button type="button" onClick={() => handleRemoveDoc('signature')} style={{ padding: '6px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Section 4: Bank Details (Full Width Card) */}
            <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
              <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px', borderBottom: '1.5px solid #e2e8f0' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={14} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>4. Bank Details</div>
                    <div style={{ fontSize: '0.71rem', color: '#64748b' }}>Required for commission & incentive payments</div>
                  </div>
                </div>

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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: bankErrors.accountHolderName ? '#ef4444' : undefined }}
                        value={bankDetails.accountHolderName}
                        onChange={(e) => {
                          setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }));
                          if (bankErrors.accountHolderName) setBankErrors(prev => ({ ...prev, accountHolderName: '' }));
                        }}
                        maxLength={100}
                      />
                    </div>
                    {bankErrors.accountHolderName && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.accountHolderName}</div>}
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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: bankErrors.bankName ? '#ef4444' : undefined }}
                        value={bankDetails.bankName}
                        onChange={(e) => {
                          setBankDetails(prev => ({ ...prev, bankName: e.target.value }));
                          if (bankErrors.bankName) setBankErrors(prev => ({ ...prev, bankName: '' }));
                        }}
                        maxLength={100}
                      />
                    </div>
                    {bankErrors.bankName && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.bankName}</div>}
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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: bankErrors.branchName ? '#ef4444' : undefined }}
                        value={bankDetails.branchName}
                        onChange={(e) => {
                          setBankDetails(prev => ({ ...prev, branchName: e.target.value }));
                          if (bankErrors.branchName) setBankErrors(prev => ({ ...prev, branchName: '' }));
                        }}
                        maxLength={100}
                      />
                    </div>
                    {bankErrors.branchName && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.branchName}</div>}
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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', borderColor: bankErrors.city ? '#ef4444' : undefined }}
                        value={bankDetails.city}
                        onChange={(e) => {
                          setBankDetails(prev => ({ ...prev, city: e.target.value }));
                          if (bankErrors.city) setBankErrors(prev => ({ ...prev, city: '' }));
                        }}
                        maxLength={80}
                      />
                    </div>
                    {bankErrors.city && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.city}</div>}
                  </div>
                </div>

                {/* Row 3: Bank Street Address (optional, full width) */}
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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', letterSpacing: '0.05em', borderColor: bankErrors.accountNumber ? '#ef4444' : undefined }}
                        value={bankDetails.accountNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                          setBankDetails(prev => ({ ...prev, accountNumber: val }));
                          if (bankErrors.accountNumber) setBankErrors(prev => ({ ...prev, accountNumber: '' }));
                        }}
                        inputMode="numeric"
                        maxLength={18}
                      />
                    </div>
                    {bankErrors.accountNumber && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.accountNumber}</div>}
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
                        style={{ height: '38px', paddingLeft: '30px', fontSize: '0.84rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', borderColor: bankErrors.ifscCode ? '#ef4444' : undefined }}
                        value={bankDetails.ifscCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                          setBankDetails(prev => ({ ...prev, ifscCode: val }));
                          if (bankErrors.ifscCode) setBankErrors(prev => ({ ...prev, ifscCode: '' }));
                        }}
                        maxLength={11}
                      />
                    </div>
                    {bankErrors.ifscCode && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>{bankErrors.ifscCode}</div>}
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Format: 4 letters + 0 + 6 alphanumeric</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Declaration & Final Submission (Full Width Card) */}
            <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
              <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    id="reg-declaration-checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    style={{ marginTop: '3px', width: '17px', height: '17px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45 }}>
                    <strong>5. Official Undertaking & Declaration:</strong> I hereby declare that all personal details (DOB, Gender, Address) and uploaded KYC documents (Aadhaar, PAN, Bank Passbook, and Digital Signature) provided in this registration are genuine, authentic, and legally accurate. I agree to adhere to the Forge India Connect Code of Conduct and regional operating guidelines.
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Already have an authorized manager account?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('login')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Sign In to Dashboard
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      minWidth: '260px',
                      padding: '11px 24px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: (!declarationAccepted || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')) ? '#94a3b8' : undefined,
                      cursor: (!declarationAccepted || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')) ? 'not-allowed' : 'pointer'
                    }}
                    disabled={loading || !declarationAccepted || (capacityInfo && capacityInfo.isFull && role !== 'pincode_manager')}
                  >
                    {loading ? (
                      'Submitting Application...'
                    ) : (
                      <>
                        Register as Manager <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </div>
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
                  background: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a'
                }}>
                  Pending Sub-Admin Approval
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: registeredUser.subAdminApprovalStatus === 'approved' ? '#15803d' : '#b45309', fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {registeredUser.subAdminApprovalStatus === 'approved' ? <CheckCircle2 size={14} /> : <Clock size={14} />} 2. Territorial Sub-admin Review
                      </span>
                      <span style={{ fontSize: '0.7rem', background: registeredUser.subAdminApprovalStatus === 'approved' ? '#dcfce7' : '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                        {registeredUser.subAdminApprovalStatus === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: registeredUser.mainAdminApprovalStatus === 'approved' ? '#15803d' : registeredUser.subAdminApprovalStatus === 'approved' ? '#b45309' : '#94a3b8', fontWeight: registeredUser.subAdminApprovalStatus === 'approved' ? 700 : 500 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {registeredUser.mainAdminApprovalStatus === 'approved' ? <CheckCircle2 size={14} /> : registeredUser.subAdminApprovalStatus === 'approved' ? <Clock size={14} /> : <Lock size={14} />} 3. Main Admin Approval
                      </span>
                      <span style={{ fontSize: '0.7rem', background: registeredUser.mainAdminApprovalStatus === 'approved' ? '#dcfce7' : registeredUser.subAdminApprovalStatus === 'approved' ? '#fef3c7' : '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                        {registeredUser.mainAdminApprovalStatus === 'approved' ? 'Approved' : registeredUser.subAdminApprovalStatus === 'approved' ? 'Pending' : 'Waiting Sub-admin'}
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
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Clock size={20} />
                  </div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#92400e', margin: '0 0 4px 0' }}>
                    {registeredUser.subAdminApprovalStatus === 'approved' ? 'Awaiting Main Admin Authorization' : 'Awaiting Sub-Admin Approval'}
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: '#b45309', margin: 0, lineHeight: 1.45 }}>
                    {registeredUser.subAdminApprovalStatus === 'approved'
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
