import React from 'react';
import { vendorService } from '../services/api';
import VendorForm from '../components/VendorForm';
import { ArrowLeft } from 'lucide-react';

const AddVendor = ({ onNavigate }) => {
  const handleCreate = async (formData) => {
    const res = await vendorService.createVendor(formData);
    if (res.success) {
      onNavigate('vendors');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
          <ArrowLeft size={16} /> Back to Vendors
        </button>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Vendor Registration</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Register and onboard a new vendor within your assigned geographic scope
          </p>
        </div>
      </div>

      <VendorForm
        onSubmit={handleCreate}
        onCancel={() => onNavigate('vendors')}
      />
    </div>
  );
};

export default AddVendor;
