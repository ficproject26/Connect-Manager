import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/api';
import { 
  MapPin, 
  Store, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  ArrowRight,
  ShieldAlert,
  Tag,
  Users
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const PincodeDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await reportService.getDashboardStats();
        if (res.success) setStats(res);
      } catch (err) {
        console.error('Failed to load Pincode Dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Pincode Dashboard...</div>;
  }

  const { statusCounts = {}, roleSpecificData = {}, recentVendors = [] } = stats || {};
  const coManager = roleSpecificData.coManager;

  return (
    <div>
      {/* 1. Hyper-Local Pincode Jurisdiction Banner */}
      <div className="dashboard-jurisdiction-banner" style={{ background: 'linear-gradient(135deg, #3b0764, #7e22ce, #1e293b)' }}>
        <div className="jurisdiction-badge" style={{ color: '#f5d0fe', background: 'rgba(255,255,255,0.18)' }}>
          Level 4 • Hyper-Local Field Operations (2 Managers)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="jurisdiction-title">
              Pincode: {user?.scope?.pincodeCode || '560034'} ({user?.scope?.pincodeArea || 'Koramangala'})
            </h2>
            <div className="jurisdiction-subtitle">
              <span>Division: <strong>{user?.scope?.divisionName}</strong></span>
              <span>•</span>
              <span>District: <strong>{user?.scope?.districtName}</strong></span>
              <span>•</span>
              <span>Logged in as: <strong>{user?.name}</strong></span>
              {coManager && (
                <>
                  <span>•</span>
                  <span>Co-Manager: <strong>{coManager.name}</strong> ({coManager.mobile})</span>
                </>
              )}
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ background: 'white', color: '#6b21a8', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
            onClick={() => onNavigate('add-vendor')}
          >
            <PlusCircle size={18} /> Register Local Vendor
          </button>
        </div>
      </div>

      {/* 2. Co-Management Notice Card */}
      {coManager && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 'var(--radius-md)',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={18} color="#15803d" />
            <span style={{ fontSize: '0.85rem', color: '#166534' }}>
              <strong>Pincode Co-Management:</strong> You and <strong>{coManager.name}</strong> ({coManager.email} • {coManager.mobile}) are the 2 assigned managers co-managing <strong>PIN {user?.scope?.pincodeCode}</strong>.
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View Pincode Vendors
          </button>
        </div>
      )}

      {/* 3. Pincode KPI Widgets */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-title">Total Local Vendors</div>
            <div className="kpi-value">{statusCounts.total || 0}</div>
            <div className="kpi-sub">Inside Pincode {user?.scope?.pincodeCode}</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #7e22ce, #a855f7)' }}>
            <Store size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Active Outlets</div>
            <div className="kpi-value" style={{ color: '#15803d' }}>{statusCounts.active || 0}</div>
            <div className="kpi-sub">Operational & verified</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Review Pipeline</div>
            <div className="kpi-value" style={{ color: '#d97706' }}>
              {(statusCounts.pending || 0) + (statusCounts.underReview || 0)}
            </div>
            <div className="kpi-sub">Awaiting field check</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Rejected / Inactive</div>
            <div className="kpi-value" style={{ color: '#e11d48' }}>
              {(statusCounts.rejected || 0) + (statusCounts.inactive || 0)}
            </div>
            <div className="kpi-sub">Compliance issues</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}>
            <ShieldAlert size={22} />
          </div>
        </div>
      </div>

      {/* 4. Category Distribution in this Pincode */}
      {roleSpecificData.subCategoryCounts && Object.keys(roleSpecificData.subCategoryCounts).length > 0 && (
        <div className="card" style={{ marginBottom: '28px' }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Local Category Density</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.entries(roleSpecificData.subCategoryCounts).map(([cat, count]) => (
              <div 
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.85rem'
                }}
              >
                <Tag size={14} color="#7e22ce" />
                <span>{cat}</span>
                <span style={{ fontWeight: 700, background: '#ede9fe', color: '#6b21a8', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Local Vendors Directory / Queue */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Vendors in Pincode {user?.scope?.pincodeCode}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct field management & review queue</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            Open Full Directory <ArrowRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Category</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentVendors.map((v) => (
                <tr key={v._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.businessName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.name}</div>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.mobile}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate('vendor-details', { vendorId: v._id })}
                    >
                      Inspect / Update Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PincodeDashboard;
