import React, { useState, useEffect } from 'react';
import { vendorService } from '../services/api';
import VendorForm from '../components/VendorForm';
import { ArrowLeft, AlertCircle } from 'lucide-react';

const EditVendor = ({ vendorId, onNavigate }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const res = await vendorService.getVendorById(vendorId, true);
        if (res.success) {
          setVendor(res.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load vendor details');
      } finally {
        setLoading(false);
      }
    };

    if (vendorId) fetchVendor();
  }, [vendorId]);

  const handleUpdate = async (formData) => {
    const res = await vendorService.updateVendor(vendorId, formData);
    if (res.success) {
      onNavigate('vendor-details', { vendorId });
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading vendor data...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{
          padding: '16px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <div>
            <strong>Access Error:</strong> {error}
          </div>
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => onNavigate('vendors')}>
          Return to Vendors
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
          <ArrowLeft size={16} /> Back to Vendors
        </button>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Edit Vendor: {vendor?.businessName}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Update contact, business profile, and banking details
          </p>
        </div>
      </div>

      <VendorForm
        initialData={vendor}
        isEditing={true}
        onSubmit={handleUpdate}
        onCancel={() => onNavigate('vendor-details', { vendorId })}
      />
    </div>
  );
};

export default EditVendor;
