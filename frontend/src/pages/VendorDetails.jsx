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
  ExternalLink
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const VendorDetails = ({ vendorId, onNavigate }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmasked, setUnmasked] = useState(false);

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
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading vendor profile...</div>;
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
        return (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => openStatusModal('Under Review')}>
              <Clock size={14} /> Move to Under Review
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
          <span style={{ fontSize: '0.8rem', color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} color="#16a34a" /> Operations Active
          </span>
        );
      case 'Inactive':
        return (
          <span style={{ fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} color="#dc2626" /> Deactivated (Admin Restricted)
          </span>
        );
      case 'Rejected':
        return (
          <span style={{ fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <XCircle size={14} color="#dc2626" /> Application Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            <ArrowLeft size={16} /> Vendors List
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{vendor.businessName}</h2>
              <StatusBadge status={vendor.status} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Registered on {new Date(vendor.createdAt).toLocaleDateString()} • ID: {vendor._id}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleMask}
            title="Toggle sensitive field masking"
          >
            {unmasked ? <><EyeOff size={14} /> Mask Sensitive Data</> : <><Eye size={14} /> Reveal Full KYC/Bank</>}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('edit-vendor', { vendorId: vendor._id })}
          >
            <Edit3 size={14} /> Edit Vendor
          </button>
        </div>
      </div>

      {/* Status Bar Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 24px', background: '#f8fafc', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Current Status & Field Notes
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
              {vendor.statusNotes || 'No verification notes recorded.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {getActionButtons()}
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Contact & Business Info */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} color="var(--primary)" /> Business Profile
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Business Category</span>
                <strong>{vendor.category}</strong> {vendor.subCategory && `(${vendor.subCategory})`}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Contact Person</span>
                <strong>{vendor.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Mobile Number</span>
                <strong>{vendor.mobile}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Email</span>
                <span>{vendor.email || 'Not provided'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Description</span>
                <p style={{ marginTop: '2px', color: '#475569', fontSize: '0.85rem' }}>
                  {vendor.description || 'No detailed description available.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Location & Jurisdiction */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="#0ea5e9" /> Location Hierarchy
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Assigned Pincode</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                  {vendor.pincodeCode} {vendor.pincodeArea && `(${vendor.pincodeArea})`}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Division</span>
                <strong>{vendor.divisionName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>District</span>
                <strong>{vendor.districtName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>State</span>
                <strong>{vendor.stateName}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* KYC & Identity */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" /> KYC & Verification
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>PAN Number</span>
                <code style={{ fontSize: '0.95rem', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                  {vendor.panNumber || 'Pending'}
                </code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>GST Number</span>
                <code style={{ fontSize: '0.95rem', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                  {vendor.gstNumber || 'Not Registered'}
                </code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', marginBottom: '6px' }}>
                  Attached Documents ({vendor.documents?.length || 0})
                </span>
                {vendor.documents?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {vendor.documents.map((doc, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem'
                      }}>
                        <span>{doc.name}</span>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          View <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No KYC documents uploaded yet.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="#8b5cf6" /> Settlement Bank
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Account Holder</span>
                <strong>{vendor.accountHolderName || 'Not configured'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Account Number</span>
                <code style={{ fontSize: '0.95rem', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                  {vendor.accountNumber || 'Not configured'}
                </code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>IFSC Code</span>
                <strong>{vendor.ifsc || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Bank & Branch</span>
                <span>{vendor.bankName || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Transition Modal */}
      {statusModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Update Vendor Status to: <span style={{ color: 'var(--primary)' }}>{targetStatus}</span>
              </h3>
            </div>
            <form onSubmit={handleStatusSubmit} style={{ padding: '24px' }}>
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

              <div className="form-group">
                <label className="form-label">
                  Verification Notes / Reason {targetStatus === 'Rejected' && '*'}
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
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
