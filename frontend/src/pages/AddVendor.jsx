import React from 'react';
import { vendorService } from '../services/api';
import VendorForm from '../components/VendorForm';
import { X, Store } from 'lucide-react';

const AddVendor = ({ onNavigate }) => {
  const handleCreate = async (formData) => {
    const res = await vendorService.createVendor(formData);
    if (res.success) {
      onNavigate('vendors');
    }
  };

  const handleClose = () => {
    onNavigate('vendors');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)'
    }}>
      {/* Backdrop click to close */}
      <div
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Modal Popup Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        maxHeight: 'min(90vh, 840px)',
        background: 'var(--bg, #ffffff)',
        borderRadius: 20,
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border, #f1f5f9)',
          background: 'var(--surface, #ffffff)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
            }}>
              <Store size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                Vendor Onboarding
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', margin: '2px 0 0 0' }}>
                Register and onboard a new business within your assigned scope
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border, #e2e8f0)',
              cursor: 'pointer',
              background: 'var(--surface, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted, #64748b)',
              transition: 'all 0.2s'
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          background: 'var(--bg-subtle, #fafafa)'
        }}>
          <VendorForm
            onSubmit={handleCreate}
            onCancel={handleClose}
          />
        </div>
      </div>
    </div>
  );
};

export default AddVendor;