import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { locationService, uploadService } from '../services/api';
import { Lock, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Food & Beverage',
  'Electronics & Retail',
  'Grocery & Essentials',
  'Automotive',
  'Home & Living',
  'Health & Fitness',
  'Apparel & Fashion',
  'Retail & Handicrafts',
  'Services & Professional'
];

const VendorForm = ({ initialData, onSubmit, isEditing = false, onCancel }) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    businessName: '',
    category: CATEGORIES[0],
    subCategory: '',
    description: '',
    stateId: '',
    districtId: '',
    divisionId: '',
    pincodeId: '',
    panNumber: '',
    gstNumber: '',
    accountHolderName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    documents: [],
    ...initialData
  });

  // Hierarchy dropdown options
  const [districts, setDistricts] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [pincodes, setPincodes] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize and load hierarchy based on manager's scope
  useEffect(() => {
    const initLocations = async () => {
      try {
        // Pre-fill locked locations from manager's assigned scope
        setFormData((prev) => ({
          ...prev,
          stateId: user?.stateId || prev.stateId,
          districtId: user?.districtId || prev.districtId,
          divisionId: user?.divisionId || prev.divisionId,
          pincodeId: user?.pincodeId || prev.pincodeId
        }));

        // Load districts if state manager
        if (user?.role === 'state_manager') {
          const res = await locationService.getDistricts(user.stateId);
          if (res.success) setDistricts(res.data);
        }

        // Load divisions if district manager
        if (user?.districtId) {
          const res = await locationService.getDivisions(user.districtId);
          if (res.success) setDivisions(res.data);
        }

        // Load pincodes if division manager
        if (user?.divisionId) {
          const res = await locationService.getPincodes(user.divisionId);
          if (res.success) setPincodes(res.data);
        }
      } catch (err) {
        console.error('Failed to initialize location options:', err);
      }
    };

    initLocations();
  }, [user]);

  // Dynamic dropdown changes for higher level managers
  const handleDistrictChange = async (e) => {
    const distId = e.target.value;
    setFormData(prev => ({ ...prev, districtId: distId, divisionId: '', pincodeId: '' }));
    setDivisions([]);
    setPincodes([]);
    if (distId) {
      const res = await locationService.getDivisions(distId);
      if (res.success) setDivisions(res.data);
    }
  };

  const handleDivisionChange = async (e) => {
    const divId = e.target.value;
    setFormData(prev => ({ ...prev, divisionId: divId, pincodeId: '' }));
    setPincodes([]);
    if (divId) {
      const res = await locationService.getPincodes(divId);
      if (res.success) setPincodes(res.data);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    setError('');
    try {
      const res = await uploadService.uploadDocument(file);
      if (res.success && res.file) {
        setFormData(prev => ({
          ...prev,
          documents: [...prev.documents, res.file]
        }));
      }
    } catch (err) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.mobile.trim() || !formData.businessName.trim()) {
      setError('Please fill in all required fields (Vendor Name, Mobile, Business Name).');
      return;
    }

    if (!formData.pincodeId) {
      setError('Please ensure a valid Pincode is selected within your assigned scope.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || 'Failed to submit vendor form');
    } finally {
      setSubmitting(false);
    }
  };

  const isStateLocked = !!user?.stateId;
  const isDistrictLocked = !!user?.districtId;
  const isDivisionLocked = !!user?.divisionId;
  const isPincodeLocked = !!user?.pincodeId;

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius-sm)',
          color: '#b91c1c',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Basic Details */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>1. Basic Contact Details</h3>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Vendor Full Name *</label>
            <input
              type="text"
              name="name"
              required
              className="form-input"
              placeholder="e.g. Rajesh Gupta"
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile Number *</label>
            <input
              type="tel"
              name="mobile"
              required
              className="form-input"
              placeholder="10-digit mobile number"
              value={formData.mobile}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="vendor@business.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* 2. Business Details */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>2. Business Profile</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Business Name *</label>
              <input
                type="text"
                name="businessName"
                required
                className="form-input"
                placeholder="e.g. Spice Route Bistro"
                value={formData.businessName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                name="category"
                className="form-select"
                value={formData.category}
                onChange={handleChange}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input
                type="text"
                name="subCategory"
                className="form-input"
                placeholder="e.g. Fine Dining / Specialty Bakery"
                value={formData.subCategory}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Business Description</label>
            <textarea
              name="description"
              rows={3}
              className="form-textarea"
              placeholder="Brief description of products, services, operating hours..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* 3. Scope-Constrained Geographic Location */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>3. Location & Field Jurisdiction</h3>
          <span style={{ fontSize: '0.75rem', color: '#6366f1', background: '#eef2ff', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
            Constrained to your Scope
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {/* State */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                State {isStateLocked && <Lock size={12} color="#64748b" />}
              </label>
              <input
                type="text"
                disabled
                className="form-input"
                value={user?.scope?.stateName || 'Assigned State'}
              />
              {isStateLocked && <span className="form-help-text">Locked to your state scope</span>}
            </div>

            {/* District */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                District {isDistrictLocked && <Lock size={12} color="#64748b" />}
              </label>
              {isDistrictLocked ? (
                <input
                  type="text"
                  disabled
                  className="form-input"
                  value={user?.scope?.districtName || 'Assigned District'}
                />
              ) : (
                <select
                  name="districtId"
                  className="form-select"
                  value={formData.districtId}
                  onChange={handleDistrictChange}
                  required
                >
                  <option value="">Select District</option>
                  {districts.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Division */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Division {isDivisionLocked && <Lock size={12} color="#64748b" />}
              </label>
              {isDivisionLocked ? (
                <input
                  type="text"
                  disabled
                  className="form-input"
                  value={user?.scope?.divisionName || 'Assigned Division'}
                />
              ) : (
                <select
                  name="divisionId"
                  className="form-select"
                  value={formData.divisionId}
                  onChange={handleDivisionChange}
                  required
                  disabled={!formData.districtId && !user?.districtId}
                >
                  <option value="">Select Division</option>
                  {divisions.map(div => (
                    <option key={div._id} value={div._id}>{div.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Pincode */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Pincode {isPincodeLocked && <Lock size={12} color="#64748b" />}
              </label>
              {isPincodeLocked ? (
                <input
                  type="text"
                  disabled
                  className="form-input"
                  value={`${user?.scope?.pincodeCode} (${user?.scope?.pincodeArea || ''})`}
                />
              ) : (
                <select
                  name="pincodeId"
                  className="form-select"
                  value={formData.pincodeId}
                  onChange={handleChange}
                  required
                  disabled={!formData.divisionId && !user?.divisionId}
                >
                  <option value="">Select Pincode</option>
                  {pincodes.map(p => (
                    <option key={p._id} value={p._id}>{p.code} - {p.areaName}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. KYC & Business Verification */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>4. Business Verification & Documents (KYC)</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">PAN Number</label>
              <input
                type="text"
                name="panNumber"
                className="form-input"
                placeholder="e.g. ABCDE1234F"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
                value={formData.panNumber}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input
                type="text"
                name="gstNumber"
                className="form-input"
                placeholder="e.g. 29ABCDE1234F1Z5"
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
                value={formData.gstNumber}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Upload Business / KYC Documents (PDF or Images, max 5MB)</label>
            <div style={{
              border: '2px dashed var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#faf5ff'
            }}>
              <Upload size={28} style={{ color: 'var(--primary)', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Select PAN card copy, GST registration, or Trade license to attach
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploadingDoc}
                style={{ fontSize: '0.85rem' }}
              />
              {uploadingDoc && <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}> Uploading...</span>}
            </div>

            {formData.documents?.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.documents.map((doc, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} color="#10b981" />
                      <strong>{doc.name}</strong>
                    </span>
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bank Details */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>5. Bank Settlement Account</h3>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Account Holder Name</label>
            <input
              type="text"
              name="accountHolderName"
              className="form-input"
              placeholder="e.g. Spice Route Bistro LLP"
              value={formData.accountHolderName}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Account Number</label>
            <input
              type="text"
              name="accountNumber"
              className="form-input"
              placeholder="Bank Account Number"
              value={formData.accountNumber}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">IFSC Code</label>
            <input
              type="text"
              name="ifsc"
              className="form-input"
              placeholder="e.g. HDFC0001234"
              style={{ textTransform: 'uppercase' }}
              value={formData.ifsc}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Bank & Branch Name</label>
            <input
              type="text"
              name="bankName"
              className="form-input"
              placeholder="e.g. HDFC Bank, Koramangala"
              value={formData.bankName}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : isEditing ? 'Update Vendor Details' : 'Register Vendor'}
        </button>
      </div>
    </form>
  );
};

export default VendorForm;
