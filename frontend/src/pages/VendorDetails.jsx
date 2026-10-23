import React, { useState, useEffect } from 'react';
import { vendorService } from '../services/api';
import { 
  ArrowLeft, 
  ShieldCheck, 
  FileText, 
  Building, 
  CreditCard, 
  MapPin, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Phone,
  Mail,
  Calendar,
  Check,
  Award,
  Store,
  UserCheck,
  Download,
  Maximize2,
  Sparkles,
  X,
  User,
  ShieldAlert,
  Layers,
  FileCheck2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { useRealtime } from '../realtime';

const FALLBACK_STOREFRONT_IMAGE = '/uploads/1791261240106_storefront_proof.jpg';

const isVendorDraftIncomplete = (v) => {
  if (!v) return false;
  if (typeof v.isEligibleForResume === 'boolean') return v.isEligibleForResume;
  if (typeof v.hasIncompleteDraft === 'boolean') return v.hasIncompleteDraft;

  const status = String(v.status || '').toLowerCase().trim();
  const approval = String(v.approvalStatus || '').toLowerCase().trim();
  const onboardingStatus = String(v.onboardingStatus || '').toLowerCase().trim();

  // If completed, approved, active, or rejected -> never an incomplete draft
  if (['approved', 'active', 'rejected', 'inactive'].includes(status)) return false;
  if (approval.includes('approved') || approval.includes('rejected')) return false;
  if (v.isCompleted === true || v.isOnboardingCompleted === true || onboardingStatus === 'completed') return false;

  // Incomplete draft flags
  if (v.isDraft === true || onboardingStatus === 'draft' || onboardingStatus === 'incomplete' || onboardingStatus === 'in_progress') {
    return true;
  }
  if (v.currentStep && Number(v.currentStep) < 5) return true;
  if (v.step && Number(v.step) < 5) return true;

  return false;
};

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const backendBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://3.110.88.42:8005';
  const cleanBase = backendBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return cleanUrl;
  }
  return `${cleanBase}${cleanUrl}`;
};

const VendorDetails = ({ vendorId, onNavigate }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmasked, setUnmasked] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);



  const fetchVendor = async (showUnmasked = false) => {
    try {
      setLoading(true);
      const res = await vendorService.getVendorById(vendorId, showUnmasked);
      if (res.success) {
        setVendor(res.data);
      }
    } catch (err) {
      setError(err.message || 'Access Denied or Vendor Not Found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) fetchVendor(unmasked);
  }, [vendorId, unmasked]);

  useRealtime('vendor', (ev) => {
    if (String(ev.entityId) === String(vendorId)) {
      if (ev.data) {
        setVendor(prev => ({ ...prev, ...ev.data }));
      } else {
        fetchVendor(unmasked);
      }
    }
  });


  const toggleMask = () => {
    setUnmasked(!unmasked);
  };



  if (loading && !vendor) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ marginTop: '14px', fontSize: '0.9rem', fontWeight: 600 }}>Loading comprehensive vendor profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{
          padding: '20px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={24} />
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>Geographic Access Restriction</h4>
            <p style={{ fontSize: '0.875rem' }}>{error}</p>
          </div>
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => onNavigate('vendors')}>
          Return to Your Vendor Directory
        </button>
      </div>
    );
  }

  // Allowed transitions based on current status
  
  // Masking helpers
  const maskText = (str, visibleStart = 2, visibleEnd = 2) => {
    if (!str) return '—';
    if (unmasked) return str;
    if (str.length <= visibleStart + visibleEnd) return '••••••••';
    const start = str.slice(0, visibleStart);
    const end = str.slice(-visibleEnd);
    return `${start}${'•'.repeat(Math.max(4, str.length - visibleStart - visibleEnd))}${end}`;
  };

  // Date safe helper
  const formatDateSafe = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Merchant physical address safe formatter
  const formatMerchantAddress = (v) => {
    if (!v) return 'Address not provided';
    if (typeof v.address === 'string' && v.address.trim()) {
      return v.address.trim();
    }
    if (typeof v.location?.address === 'string' && v.location.address.trim()) {
      return v.location.address.trim();
    }
    if (typeof v.businessAddress === 'string' && v.businessAddress.trim()) {
      return v.businessAddress.trim();
    }
    const parts = [
      v.street || v.doorNo || v.building,
      v.area || v.pincodeArea,
      v.city || v.division || v.divisionName,
      v.district || v.districtName,
      v.state || v.stateName,
      (v.pincode || v.pincodeCode) ? `PIN: ${v.pincode || v.pincodeCode}` : null
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    return 'Address not provided';
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ─── 1. Top Header & Action Toolbar ─── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Left: Back + Business Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('vendors')}
              title="Back to Vendors Directory"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '10px'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            {(vendor.logo || vendor.shopLogo) && (
              <img
                src={resolveMediaUrl(vendor.logo || vendor.shopLogo)}
                alt="Shop Logo"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1px solid var(--border)',
                  flexShrink: 0
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {vendor.businessName || vendor.name}
                </h2>
                <StatusBadge status={vendor.status} />
                {vendor.pincodeAdminApproval?.status === 'Approved' && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle2 size={12} /> Pincode Admin Approved
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>ID: <code style={{ fontWeight: 700 }}>{vendor._id || vendor.id}</code></span>
                <span>•</span>
                <span>Category: <strong>{vendor.category}</strong> {vendor.subCategory && `(${vendor.subCategory})`}</span>
                <span>•</span>
                <span>Registered: {formatDateSafe(vendor.createdAt)}</span>
                <span>•</span>
                <span>
                  Registered By:{' '}
                  <strong style={{ color: 'var(--text-main)' }}>
                    {vendor.registeredBy?.name || vendor.agentName || vendor.assignedManagerName || vendor.addedBy?.name || (vendor.source === 'vendor' || vendor.selfRegistered ? 'Self-registered' : 'System / Legacy')}
                  </strong>
                  {' '}
                  <span style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 }}>
                    ({vendor.registeredBy?.role || (vendor.agentName ? 'Agent' : (vendor.assignedManagerRole ? vendor.assignedManagerRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (vendor.source === 'vendor' || vendor.selfRegistered ? 'Vendor' : 'Manager')))})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isVendorDraftIncomplete(vendor) && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('resume-onboarding', {
                      fieldVisitId: vendor.fieldVisitId || vendor._id,
                      prefillData: {
                        ...vendor,
                        shopName: vendor.businessName || vendor.name,
                        businessName: vendor.businessName || vendor.name,
                        category: vendor.category || 'Products',
                        mobile: vendor.mobile || vendor.phone || ''
                      }
                    });
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                }}
              >
                <Sparkles size={14} /> Resume Onboarding
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleMask}
              title="Toggle sensitive field masking"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {unmasked ? <><EyeOff size={14} /> Mask Sensitive</> : <><Eye size={14} /> Reveal Full Data</>}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Top Summary KPI Stats Strip ─── */}
      <div className="tasks-kpi-grid" style={{ marginBottom: '22px' }}>
        {/* Card 1: Operational Status */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Operational Status
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {vendor.status || 'Active'}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
              {vendor.approvalStatus || 'Pincode Admin Approved'}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={22} />
          </div>
        </div>

        {/* Card 2: Jurisdiction & Pincode */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Station Pincode
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7', marginTop: '4px', fontFamily: 'monospace' }}>
              {vendor.pincode || vendor.pincodeCode}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {vendor.division || vendor.divisionName} • {vendor.district || vendor.districtName}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={22} />
          </div>
        </div>

        {/* Card 3: ONBOARDED BY */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ONBOARDED BY
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: (vendor.onboardedBy?.name || vendor.assignedFieldManager?.name || vendor.assignedManager?.name || vendor.assignedManagerName || vendor.addedBy?.name) ? 'var(--text-main)' : 'var(--text-muted)', marginTop: '4px' }}>
              {vendor.onboardedBy?.name || vendor.assignedFieldManager?.name || vendor.assignedManager?.name || vendor.assignedManagerName || vendor.addedBy?.name || 'Assignment details unavailable'}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
              {vendor.onboardedBy?.designation || vendor.assignedFieldManager?.designation || (vendor.assignedManagerRole ? vendor.assignedManagerRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (vendor.addedBy?.role === 'pincode_manager' ? 'Pincode Manager' : (vendor.assignedFieldManager?.name ? 'Field Manager' : 'Unassigned')))}
            </div>
            {vendor.fieldSupervisor?.name && (
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                Supervisor: {vendor.fieldSupervisor.name}
              </div>
            )}
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={22} />
          </div>
        </div>

        {/* Card 4: Settlement Readiness */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Settlement Banking
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {vendor.bankName || 'SBI'} Verified
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              T+1 Auto Credit • IFSC Validated
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} />
          </div>
        </div>
      </div>

      {/* ─── 3. Main Balanced Multi-Column Content Grid ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ── Column 1: Commercial & Identity ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Business Profile */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Building size={18} color="var(--primary)" /> Business Profile
              </h3>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              <div className="responsive-grid-2" style={{ gap: '14px', fontSize: '0.86rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Business Category</span>
                  <strong style={{ color: 'var(--text-main)' }}>{vendor.category || 'General'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Sub-Category</span>
                  <strong>{vendor.subCategory || 'General Merchandise'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Contact Person</span>
                  <strong>{vendor.contactPerson || vendor.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Mobile Number</span>
                  {(vendor.mobile || vendor.phone) ? (
                    <a href={`tel:${String(vendor.mobile || vendor.phone).replace(/^\+91\s*/, '')}`} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                      +91 {String(vendor.mobile || vendor.phone).replace(/^\+91\s*/, '')}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
                {(vendor.alternatePhone || vendor.altPhone) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Alternate Phone</span>
                    <a href={`tel:${String(vendor.alternatePhone || vendor.altPhone).replace(/^\+91\s*/, '')}`} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                      +91 {String(vendor.alternatePhone || vendor.altPhone).replace(/^\+91\s*/, '')}
                    </a>
                  </div>
                )}
                {vendor.agentName && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Agent Name</span>
                    <strong>{vendor.agentName}</strong>
                  </div>
                )}
                {(vendor.coPartnerName || vendor.copartnerName) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Co-Partner Name</span>
                    <strong>{vendor.coPartnerName || vendor.copartnerName}</strong>
                  </div>
                )}
                {(vendor.logo || vendor.shopLogo) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Shop Logo</span>
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={resolveMediaUrl(vendor.logo || vendor.shopLogo)}
                        alt="Shop Logo"
                        style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Uploaded</span>
                    </div>
                  </div>
                )}
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Official Email</span>
                  <span style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{vendor.email || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Operating Hours</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>{vendor.operatingHours || '9:00 AM - 9:00 PM'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Storefront Description</span>
                  <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.84rem', lineHeight: '1.45', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {vendor.description || vendor.address || 'No detailed storefront description registered.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Settlement Bank */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <CreditCard size={18} color="#8b5cf6" /> Settlement Bank
                </h3>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                  Auto-Disbursement Active
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Holder:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{vendor.accountHolderName || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                    {vendor.accountNumber ? (unmasked ? vendor.accountNumber : (vendor.accountNumber.includes('•') ? vendor.accountNumber : maskText(vendor.accountNumber, 4, 4))) : '—'}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{vendor.ifsc || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bank & Branch:</span>
                  <span>{vendor.bankName || '—'}{vendor.bankBranch ? ` (${vendor.bankBranch})` : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Settlement Cycle:</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>T+1 Automated Daily Payout</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Location & Territory Hierarchy ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Location Hierarchy */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <MapPin size={18} color="#0ea5e9" /> Location Hierarchy
              </h3>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.86rem' }}>
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ color: '#0369a1', display: 'block', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Pincode Station</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0284c7', fontFamily: 'monospace' }}>
                      {vendor.pincode || vendor.pincodeCode}
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#0369a1', marginTop: '2px' }}>
                      {vendor.division || vendor.divisionName} Region ({vendor.district || vendor.districtName})
                    </span>
                  </div>
                  <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                    IN-SCOPE
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Division:</span>
                  <strong>{vendor.division || vendor.divisionName || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>District:</span>
                  <strong>{vendor.district || vendor.districtName || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>State:</span>
                  <strong>{vendor.state || vendor.stateName || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Physical Merchant Address:</span>
                  <div style={{ marginTop: '4px', color: '#334155', fontSize: '0.84rem', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {formatMerchantAddress(vendor)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Verification & Onboarding Audit Trail */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileCheck2 size={18} color="#6366f1" /> Onboarding & Verification Audit
                </h3>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: ['Approved', 'Active'].includes(vendor.status) ? '#ecfdf5' : (vendor.status === 'Rejected' ? '#fef2f2' : '#eff6ff'),
                  color: ['Approved', 'Active'].includes(vendor.status) ? '#059669' : (vendor.status === 'Rejected' ? '#dc2626' : '#2563eb')
                }}>
                  {vendor.status || 'Pending Verification'}
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              {(() => {
                const isApproved = ['Approved', 'Active', 'Completed'].includes(vendor.status) ||
                  vendor.approvalStatus === 'Approved' ||
                  vendor.pincodeAdminApproval?.status === 'Approved' ||
                  Boolean(vendor.pincodeApproval?.approvedBy);
                const isRejected = vendor.status === 'Rejected' ||
                  vendor.approvalStatus === 'Rejected' ||
                  vendor.pincodeAdminApproval?.status === 'Rejected' ||
                  Boolean(vendor.pincodeRejection);
                const isPending = !isApproved && !isRejected;

                const approverName = vendor.pincodeApproval?.approvedBy ||
                  vendor.pincodeAdminApproval?.decidedBy ||
                  vendor.assignedPincodeAdminName ||
                  vendor.pincodeAdminName ||
                  (isApproved ? 'Authorized Pincode Admin' : null);

                const rejectionReason = vendor.pincodeRejection?.reason ||
                  vendor.pincodeAdminApproval?.rejectionReason ||
                  vendor.rejectionReason ||
                  vendor.statusNotes ||
                  'Verification criteria not met';

                const approvalDate = vendor.pincodeApproval?.approvedAt ||
                  vendor.pincodeAdminApproval?.decidedAt ||
                  vendor.approvedAt ||
                  (isApproved ? vendor.updatedAt : null);

                const hasPan = Boolean(vendor.panNumber && vendor.panNumber !== 'N/A' && String(vendor.panNumber).trim() !== '');
                const hasBank = Boolean(vendor.accountNumber && vendor.accountNumber !== 'N/A' && String(vendor.accountNumber).trim() !== '' && vendor.ifsc && String(vendor.ifsc).trim() !== '');
                const isKycVerified = vendor.kycStatus === 'verified' ||
                  vendor.kycStatus === 'Approved' ||
                  vendor.isKycApproved === true ||
                  (isApproved && hasPan && hasBank);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                    {/* Step 1: Application Submission */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <Check size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Vendor Application Submitted
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>Completed</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Registered by {vendor.assignedFieldManager?.name || vendor.assignedManager?.name || vendor.assignedManagerName || vendor.addedBy?.name || 'Field Operations Manager'} on {formatDateSafe(vendor.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Pincode Admin Authorization */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isApproved ? '#dcfce7' : (isRejected ? '#fee2e2' : '#fef3c7'),
                        color: isApproved ? '#16a34a' : (isRejected ? '#dc2626' : '#d97706'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {isApproved ? <Check size={14} /> : (isRejected ? <X size={14} /> : <Clock size={14} />)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: isApproved ? 'var(--text-main)' : (isRejected ? '#dc2626' : '#b45309'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Pincode Admin Authorization
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isApproved ? '#ecfdf5' : (isRejected ? '#fef2f2' : '#fef3c7'),
                            color: isApproved ? '#16a34a' : (isRejected ? '#dc2626' : '#b45309')
                          }}>
                            {isApproved ? 'Approved' : (isRejected ? 'Rejected' : 'Under Review')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {isApproved ? (
                            `Cleared by ${approverName} • Verification Approved${approvalDate ? ` (${formatDateSafe(approvalDate)})` : ''}`
                          ) : isRejected ? (
                            `Rejected by ${approverName || 'Pincode Admin'} • Reason: ${rejectionReason}`
                          ) : (
                            `Assigned to ${vendor.assignedPincodeAdminName || 'Pincode Station Admin'} • Awaiting on-ground inspection & authorization`
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Settlement & Statutory KYC Status */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isKycVerified ? '#dcfce7' : '#eff6ff',
                        color: isKycVerified ? '#16a34a' : '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {isKycVerified ? <Check size={14} /> : <Clock size={14} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: isKycVerified ? '#16a34a' : '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Settlement & Statutory KYC
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isKycVerified ? '#ecfdf5' : '#eff6ff',
                            color: isKycVerified ? '#16a34a' : '#2563eb'
                          }}>
                            {isKycVerified ? 'Ready' : 'Pending'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {isKycVerified ? (
                            `PAN & Bank details validated for local commerce • Settlement Active (${vendor.bankName || 'Linked Bank Account'})`
                          ) : (
                            `PAN: ${hasPan ? 'Provided' : 'Pending'} • Bank: ${hasBank ? (vendor.bankName || 'Provided') : 'Pending'} • Documents: ${vendor.documents?.length || 0} attached`
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Column 3: KYC, Identity & Document Proofs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: KYC & Statutory Verification */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <ShieldCheck size={18} color="#10b981" /> KYC & Statutory Identity
                </h3>
                {(() => {
                  const isApproved = ['Approved', 'Active', 'Completed'].includes(vendor.status);
                  const hasPan = Boolean(vendor.panNumber && vendor.panNumber !== 'N/A' && String(vendor.panNumber).trim() !== '');
                  const hasBank = Boolean(vendor.accountNumber && vendor.accountNumber !== 'N/A' && String(vendor.accountNumber).trim() !== '');
                  const isKycVerified = vendor.kycStatus === 'verified' || vendor.kycStatus === 'Approved' || (isApproved && hasPan && hasBank);
                  const isRejected = vendor.status === 'Rejected' || vendor.kycStatus === 'rejected';
                  return (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isKycVerified ? '#059669' : (isRejected ? '#dc2626' : '#d97706'),
                      background: isKycVerified ? '#dcfce7' : (isRejected ? '#fee2e2' : '#fef3c7'),
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {isKycVerified ? 'Verified' : (isRejected ? 'Rejected' : 'Pending Verification')}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PAN Card:</span>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {maskText(vendor.panNumber, 2, 2)}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Aadhaar Number:</span>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {maskText(vendor.aadhaarNumber, 2, 4)}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GSTIN Registration:</span>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {maskText(vendor.gstNumber, 2, 3)}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GST Registration Status:</span>
                  <span style={{ fontWeight: 600, color: '#475569' }}>{vendor.gstStatus || 'Registered'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>MSME Category:</span>
                  <span style={{ fontWeight: 600, color: '#475569' }}>{vendor.msmeStatus || 'Micro Enterprise'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Attached Documents & Storefront Visual Proofs */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(() => {
              // 1. Gather all business images explicitly saved on the vendor
              const explicitBusinessImages = (Array.isArray(vendor.businessImages) ? vendor.businessImages : [])
                .filter(img => img && (typeof img === 'string' ? img.trim().length > 0 : Boolean(img.url || img.filename || img.path)))
                .map((img, idx) => {
                  if (typeof img === 'string') {
                    const fn = img.split('/').pop() || `Business Image ${idx + 1}`;
                    return { url: img, name: fn, filename: fn, type: 'image/jpeg' };
                  }
                  const url = img.url || img.path || '';
                  const fn = img.name || img.filename || (url ? url.split('/').pop() : `Business Image ${idx + 1}`);
                  return {
                    url,
                    name: fn,
                    filename: img.filename || fn,
                    size: img.size || 0,
                    type: img.type || 'image/jpeg'
                  };
                });

              // 2. Check for single storefrontPhoto or shopPhoto not already included
              const additionalStorefronts = [];
              if (vendor.storefrontPhoto && !explicitBusinessImages.some(i => i.url === vendor.storefrontPhoto)) {
                additionalStorefronts.push({
                  url: vendor.storefrontPhoto,
                  name: 'Storefront On-Ground Photo.jpg',
                  type: 'image/jpeg'
                });
              }
              if (vendor.shopPhoto && vendor.shopPhoto !== vendor.storefrontPhoto && !explicitBusinessImages.some(i => i.url === vendor.shopPhoto)) {
                additionalStorefronts.push({
                  url: vendor.shopPhoto,
                  name: 'Shop Photo.jpg',
                  type: 'image/jpeg'
                });
              }

              // 3. Check for storefront photos in documents
              const docStorefrontPhotos = [];
              if (Array.isArray(vendor.documents)) {
                vendor.documents.forEach((d, idx) => {
                  const rawUrl = typeof d === 'string' ? d : d?.url;
                  const name = typeof d === 'string' ? d.split('/').pop() : (d?.name || '');
                  if (rawUrl && (name.toLowerCase().includes('storefront') || name.toLowerCase().includes('on-ground'))) {
                    if (!explicitBusinessImages.some(i => i.url === rawUrl) && !additionalStorefronts.some(i => i.url === rawUrl)) {
                      docStorefrontPhotos.push(typeof d === 'string' ? { url: d, name: name || `Storefront Photo ${idx + 1}`, type: 'image/jpeg' } : d);
                    }
                  }
                });
              }

              // Combined storefront proofs
              const allStorefrontImages = [...explicitBusinessImages, ...additionalStorefronts, ...docStorefrontPhotos];

              // Separate KYC / Statutory documents
              const kycDocs = (Array.isArray(vendor.documents) ? vendor.documents : []).filter(d => {
                const rawUrl = typeof d === 'string' ? d : d?.url;
                if (!rawUrl) return false;
                return !allStorefrontImages.some(i => i.url === rawUrl);
              });
              if (vendor.businessLicense) {
                const licUrl = typeof vendor.businessLicense === 'string' ? vendor.businessLicense : vendor.businessLicense.url;
                if (licUrl && !kycDocs.some(d => (typeof d === 'string' ? d : d.url) === licUrl)) {
                  kycDocs.unshift(typeof vendor.businessLicense === 'string' ? { url: licUrl, name: 'Business License', type: 'application/pdf' } : vendor.businessLicense);
                }
              }

              return (
                <>
                  <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <FileText size={18} color="#f59e0b" /> Verified Storefront Proofs ({allStorefrontImages.length})
                      </h3>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
                        {allStorefrontImages.length > 0 ? `${allStorefrontImages.length} On-Ground Photo${allStorefrontImages.length > 1 ? 's' : ''}` : 'On-Ground Photo'}
                      </span>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: '18px' }}>
                    {allStorefrontImages.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {allStorefrontImages.map((rawDoc, idx) => {
                          const doc = typeof rawDoc === 'string'
                            ? { url: rawDoc, name: rawDoc.split('/').pop() || `Business Image ${idx + 1}`, size: 0 }
                            : (rawDoc || {});
                          const rawUrl = doc.url || '';
                          const resolvedUrl = resolveMediaUrl(rawUrl);
                          const docName = doc.name || `Business Image ${idx + 1}`;
                          const isDocPdf = Boolean(
                            doc.type === 'application/pdf' ||
                            (doc.type && doc.type.toLowerCase().includes('pdf')) ||
                            docName.toLowerCase().endsWith('.pdf') ||
                            rawUrl.toLowerCase().endsWith('.pdf') ||
                            (typeof rawUrl === 'string' && rawUrl.startsWith('data:application/pdf'))
                          );

                          return (
                            <div key={idx} style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              overflow: 'hidden'
                            }}>
                              {resolvedUrl && isDocPdf ? (
                                <div 
                                  onClick={() => setPreviewDoc({ url: resolvedUrl, name: docName, isPdf: true })}
                                  style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '140px',
                                    cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '16px',
                                    borderBottom: '1px solid #fecaca'
                                  }}
                                  title="Click to preview PDF document"
                                >
                                  <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '10px',
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)',
                                    marginBottom: '8px'
                                  }}>
                                    <FileText size={24} />
                                  </div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {docName}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Eye size={12} /> Tap to preview document
                                  </div>
                                </div>
                              ) : resolvedUrl ? (
                                <div 
                                  onClick={() => setPreviewDoc({ url: resolvedUrl, name: docName, isPdf: false })}
                                  style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '140px',
                                    cursor: 'pointer',
                                    background: '#f1f5f9',
                                    overflow: 'hidden'
                                  }}
                                  title="Click to view full image"
                                >
                                  <img
                                    src={resolvedUrl}
                                    alt={docName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="%23f1f5f9"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="%2364748b">Business Image Preview</text><text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="11" fill="%2394a3b8">Tap to view full resolution</text></svg>';
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.3)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    gap: '4px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                  >
                                    <Maximize2 size={16} /> Tap to expand
                                  </div>
                                </div>
                              ) : null}
                              <div style={{
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {docName}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {isDocPdf ? 'Storefront Document (PDF)' : 'Storefront Visual Proof'} • {doc.size ? `${Math.round(doc.size / 1024)} KB` : (isDocPdf ? 'Verified PDF' : 'Verified Image')}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {resolvedUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc({ url: resolvedUrl, name: docName, isPdf: isDocPdf })}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Eye size={12} /> View
                                    </button>
                                  )}
                                  {resolvedUrl && (
                                    <a
                                      href={resolvedUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      download
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)' }}>
                        <Store size={32} style={{ color: '#cbd5e1', marginBottom: '6px' }} />
                        <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>No business images uploaded.</div>
                        <div style={{ fontSize: '0.74rem' }}>KYC agent will capture storefront photos during verification visit.</div>
                      </div>
                    )}

                    {/* Attached KYC Documents & Licenses */}
                    {kycDocs.length > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={14} color="#10b981" /> Attached KYC & License Documents ({kycDocs.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {kycDocs.map((rawDoc, kidx) => {
                            const kdoc = typeof rawDoc === 'string' ? { url: rawDoc, name: rawDoc.split('/').pop() } : rawDoc;
                            const kUrl = resolveMediaUrl(kdoc.url || '');
                            const isPdf = kdoc.type?.includes('pdf') || (kdoc.url || '').toLowerCase().endsWith('.pdf');
                            return (
                              <div key={kidx} style={{
                                padding: '8px 10px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {kdoc.name || `Document ${kidx + 1}`}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {isPdf ? 'PDF Document' : 'Statutory File'} • {kdoc.size ? `${Math.round(kdoc.size / 1024)} KB` : 'Verified'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {kUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc({ url: kUrl, name: kdoc.name || `Document ${kidx + 1}`, isPdf })}
                                      style={{
                                        padding: '3px 6px',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      View
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── Lightbox Modal for Full Image or PDF View ─── */}
      {(previewDoc || previewImage) && (() => {
        const activeUrl = previewDoc?.url || previewImage;
        const activeName = previewDoc?.name || (typeof activeUrl === 'string' ? activeUrl.split('/').pop() : 'Document Preview');
        const isPdf = Boolean(previewDoc?.isPdf || (typeof activeUrl === 'string' && (
          activeUrl.toLowerCase().includes('.pdf') ||
          activeUrl.startsWith('data:application/pdf') ||
          activeName.toLowerCase().endsWith('.pdf')
        )));

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewImage(null);
              setPreviewDoc(null);
            }
          }}
          >
            <div style={{
              position: 'relative',
              width: isPdf ? '90vw' : 'auto',
              maxWidth: isPdf ? '1100px' : '90vw',
              maxHeight: '92vh',
              background: isPdf ? '#ffffff' : 'transparent',
              borderRadius: '14px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Modal Top Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                background: isPdf ? '#f8fafc' : 'rgba(0,0,0,0.65)',
                borderBottom: isPdf ? '1px solid #e2e8f0' : 'none',
                color: isPdf ? '#0f172a' : '#ffffff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {isPdf ? <FileText size={18} color="#dc2626" /> : <Eye size={18} />}
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeName}
                  </span>
                  {isPdf && (
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px' }}>
                      PDF Document
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => window.open(activeUrl, '_blank')}
                    title="Open in new window / tab"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: isPdf ? '#eff6ff' : 'rgba(255,255,255,0.2)',
                      color: isPdf ? '#2563eb' : '#ffffff',
                      border: isPdf ? '1px solid #bfdbfe' : 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={12} /> Open in New Tab
                  </button>
                  <a
                    href={activeUrl}
                    download={activeName}
                    title="Download document"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: isPdf ? '#f1f5f9' : 'rgba(255,255,255,0.2)',
                      color: isPdf ? '#475569' : '#ffffff',
                      border: isPdf ? '1px solid #e2e8f0' : 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    <Download size={12} /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(null);
                      setPreviewDoc(null);
                    }}
                    title="Close preview"
                    style={{
                      background: isPdf ? '#fee2e2' : 'rgba(255,255,255,0.2)',
                      color: isPdf ? '#dc2626' : '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      marginLeft: '4px'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Body: Embedded iframe for PDF or img for image */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isPdf ? '0' : '10px',
                maxHeight: 'calc(92vh - 56px)',
                overflow: 'auto',
                background: isPdf ? '#ffffff' : 'transparent'
              }}>
                {isPdf ? (
                  <iframe
                    src={activeUrl}
                    title={activeName}
                    style={{
                      width: '100%',
                      height: '76vh',
                      border: 'none',
                      display: 'block',
                      background: '#ffffff'
                    }}
                  />
                ) : (
                  <img
                    src={activeUrl}
                    alt={activeName}
                    style={{
                      maxWidth: '88vw',
                      maxHeight: '80vh',
                      borderRadius: '8px',
                      display: 'block',
                      objectFit: 'contain'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default VendorDetails;
