import React, { useState, useEffect } from 'react';
import { vendorService } from '../services/api';
import { UserCheck, Search, Filter, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const VendorRequests = ({ onNavigate }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await vendorService.getVendors({ status: 'Pending' });
        if (res.success) {
          setVendors(res.data);
        }
      } catch (err) {
        console.error('Failed to load vendor requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const pendingList = vendors.filter(v => 
    v.businessName?.toLowerCase().includes(search.toLowerCase()) || 
    v.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Vendor Onboarding Requests
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Review, verify documentation, and approve incoming vendor merchant requests in your territory
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('add-vendor')}>
          + Onboard New Vendor
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search pending request by business or owner name..."
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '22%', textAlign: 'left', paddingLeft: '20px' }}>Business Name</th>
              <th style={{ width: '16%', textAlign: 'left' }}>Category</th>
              <th style={{ width: '15%', textAlign: 'left' }}>Applicant</th>
              <th style={{ width: '14%', textAlign: 'left' }}>Contact</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
              <th style={{ width: '11%', textAlign: 'center' }}>Submission Date</th>
              <th style={{ width: '12%', textAlign: 'center', paddingRight: '20px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading requests...</td>
              </tr>
            ) : pendingList.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No pending vendor requests requiring action in your scope.
                </td>
              </tr>
            ) : (
              pendingList.map((v) => (
                <tr key={v._id}>
                  <td style={{ paddingLeft: '20px' }}>
                    <strong style={{ color: '#0f172a' }}>{v.businessName}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>GSTIN: {v.gstin || 'N/A'}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{v.category}</span>
                  </td>
                  <td>{v.name}</td>
                  <td>+91 {v.mobile}</td>
                  <td style={{ textAlign: 'center' }}><StatusBadge status={v.status} /></td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('vendor-details', { vendorId: v._id })}
                      style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 600 }}
                    >
                      Review KYC <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorRequests;
