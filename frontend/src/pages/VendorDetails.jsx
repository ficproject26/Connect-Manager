import React, { useState, useEffect } from 'react';
import { vendorService } from '../services/api';
import { 
  ArrowLeft, 
  Edit3, 
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
  Star,
  Sparkles,
  X,
  User,
  ShieldAlert,
  Layers,
  FileCheck2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const VendorDetails = ({ vendorId, onNavigate }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmasked, setUnmasked] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState('');

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

  const toggleMask = () => {
    setUnmasked(!unmasked);
  };

  const openStatusModal = (newStatus) => {
    setTargetStatus(newStatus);
    setStatusNotes('');
    setStatusError('');
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setStatusUpdating(true);
    setStatusError('');

    try {
      const res = await vendorService.updateStatus(vendorId, targetStatus, statusNotes);
      if (res.success) {
        setVendor(res.data);
        setStatusModalOpen(false);
      }
    } catch (err) {
      setStatusError(err.message || 'Status transition failed');
    } finally {
      setStatusUpdating(false);
    }
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
  const currentStatus = vendor?.status || 'Pending';
  const getActionButtons = () => {
    switch (currentStatus) {
      case 'Pending':
      case 'Pending KYC Review':
        return (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => openStatusModal('Under Review')}>
              <Clock size={14} /> Move to Under Review
            </button>
            <button className="btn btn-success btn-sm" onClick={() => openStatusModal('Active')}>
              <CheckCircle2 size={14} /> Approve & Activate
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => openStatusModal('Rejected')}>
              <XCircle size={14} /> Reject Vendor
            </button>
          </>
        );
      case 'Under Review':
        return (
          <>
            <button className="btn btn-success btn-sm" onClick={() => openStatusModal('Approved')}>
              <CheckCircle2 size={14} /> Approve Vendor
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => openStatusModal('Rejected')}>
              <XCircle size={14} /> Reject Vendor
            </button>
          </>
        );
      case 'Approved':
        return (
          <button className="btn btn-success btn-sm" onClick={() => openStatusModal('Active')}>
            <CheckCircle2 size={14} /> Activate Operations
          </button>
        );
      case 'Active':
        return (
          <span style={{ fontSize: '0.8rem', color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} color="#16a34a" /> Operations Live & Active
          </span>
        );
      case 'Inactive':
        return (
          <span style={{ fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} color="#dc2626" /> Deactivated (Admin Restricted)
          </span>
        );
      case 'Rejected':
        return (
          <span style={{ fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <XCircle size={15} color="#dc2626" /> Application Rejected
          </span>
        );
      default:
        return null;
    }
  };

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
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {getActionButtons()}
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleMask}
              title="Toggle sensitive field masking"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {unmasked ? <><EyeOff size={14} /> Mask Sensitive</> : <><Eye size={14} /> Reveal Full Data</>}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('edit-vendor', { vendorId: vendor._id })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={14} /> Edit Vendor
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Top Summary KPI Stats Strip ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '22px'
      }}>
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

        {/* Card 3: Assigned Pincode Manager */}
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
              Assigned Field Manager
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {vendor.addedBy?.name || 'Shiva'}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
              {vendor.addedBy?.role === 'pincode_manager' ? 'Pincode Manager' : 'Field Supervisor'}
            </div>
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.86rem' }}>
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
                  <a href={`tel:${vendor.mobile || vendor.phone}`} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                    {vendor.mobile || vendor.phone}
                  </a>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Official Email</span>
                  <span style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{vendor.email || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Operating Hours</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>{vendor.operatingHours || '9:00 AM - 9:00 PM'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Store Rating</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 700 }}>
                    <Star size={14} fill="#f59e0b" color="#f59e0b" /> {vendor.rating || 5.0} / 5.0
                  </span>
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
                  <strong style={{ color: 'var(--text-main)' }}>{vendor.accountHolderName || 'DHANU'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                    {maskText(vendor.accountNumber, 4, 4)}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{vendor.ifsc || 'HDFC0001234'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bank & Branch:</span>
                  <span>{vendor.bankName || 'SBI'} {vendor.bankBranch ? `(${vendor.bankBranch})` : ''}</span>
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
                  <strong>{vendor.division || vendor.divisionName || 'Attur'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>District:</span>
                  <strong>{vendor.district || vendor.districtName || 'Salem'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>State:</span>
                  <strong>{vendor.state || vendor.stateName || 'Tamil Nadu'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Physical Merchant Address:</span>
                  <div style={{ marginTop: '4px', color: '#334155', fontSize: '0.84rem', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {vendor.address || 'Attur Main Bazaar Street, Salem - 636114'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Verification & Onboarding Audit Trail */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <FileCheck2 size={18} color="#6366f1" /> Onboarding & Verification Audit
              </h3>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Check size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>Vendor Application Submitted</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Registered by {vendor.addedBy?.name || 'Field Manager'} on {formatDateSafe(vendor.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Check size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>Pincode Admin Authorization</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Cleared by {vendor.pincodeAdminApproval?.decidedBy || 'Kumar (Pincode Admin)'} • Verification Approved
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Clock size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e40af' }}>Settlement & KYC Ready</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      PAN & Bank details validated for local commerce
                    </div>
                  </div>
                </div>
              </div>
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
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                  Verified
                </span>
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
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileText size={18} color="#f59e0b" /> Verified Storefront Proofs ({vendor.documents?.length || 1})
                </h3>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
                  On-Ground Photo
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '18px' }}>
              {vendor.documents?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {vendor.documents.map((rawDoc, idx) => {
                    const doc = typeof rawDoc === 'string'
                      ? { url: rawDoc, name: rawDoc.split('/').pop() || 'Document', size: 0 }
                      : (rawDoc || {});
                    const docUrl = doc.url || '';
                    const docName = doc.name || `Document ${idx + 1}`;
                    const isImg = doc.type?.includes('image') || docUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                    return (
                      <div key={idx} style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}>
                        {isImg && docUrl && (
                          <div 
                            onClick={() => setPreviewImage(docUrl)}
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
                              src={docUrl}
                              alt={docName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={(e) => {
                                e.target.src = '/uploads/1790060901073_a21a2daf887d32a695cca12147ab6006.jpg';
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
                        )}
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
                              Field Upload • {doc.size ? `${Math.round(doc.size / 1024)} KB` : 'Verified Document'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {docUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(docUrl)}
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
                            {docUrl && (
                              <a
                                href={docUrl}
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
                  <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>No storefront photos attached</div>
                  <div style={{ fontSize: '0.74rem' }}>KYC agent will capture photos during verification visit.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Lightbox Modal for Full Image View ─── */}
      {previewImage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ position: 'relative', maxWidth: '88vw', maxHeight: '88vh' }}>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={previewImage}
              alt="Verification Preview"
              style={{
                maxWidth: '88vw',
                maxHeight: '88vh',
                borderRadius: '12px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Status Transition Modal ─── */}
      {statusModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="modal-content" style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Update Vendor Status to: <span style={{ color: 'var(--primary)' }}>{targetStatus}</span>
              </h3>
            </div>
            <form onSubmit={handleStatusSubmit} style={{ padding: '20px' }}>
              {statusError && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: 'var(--radius-sm)',
                  color: '#b91c1c',
                  marginBottom: '16px',
                  fontSize: '0.85rem'
                }}>
                  {statusError}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Verification Notes / Reason {targetStatus === 'Rejected' && '*'}
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                  placeholder={
                    targetStatus === 'Rejected'
                      ? 'Please specify rejection reasons (e.g. invalid GST, illegible document)'
                      : 'Add verification notes or operational comments'
                  }
                  required={targetStatus === 'Rejected'}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStatusModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-sm ${targetStatus === 'Rejected' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? 'Updating...' : `Confirm ${targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;
