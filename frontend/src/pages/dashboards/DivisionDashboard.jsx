import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/api';
import { 
  MapPin, 
  Store, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowRight,
  TrendingUp,
  PlusCircle,
  Users
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const DivisionDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await reportService.getDashboardStats();
        if (res.success) setStats(res);
      } catch (err) {
        console.error('Failed to load Division Dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Division Dashboard...</div>;
  }

  const { statusCounts = {}, roleSpecificData = {}, recentVendors = [] } = stats || {};
  const coManager = roleSpecificData.coManager;

  return (
    <div>
      {/* 1. Division Jurisdiction Banner */}
      <div className="dashboard-jurisdiction-banner" style={{ background: 'linear-gradient(135deg, #134e4a, #0d9488, #1e293b)' }}>
        <div className="jurisdiction-badge" style={{ color: '#99f6e4', background: 'rgba(255,255,255,0.18)' }}>
          Level 3 • Division Operations Command (2 Managers)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="jurisdiction-title">Division: {user?.scope?.divisionName || 'Bengaluru South'}</h2>
            <div className="jurisdiction-subtitle">
              <span>District: <strong>{user?.scope?.districtName}</strong></span>
              <span>•</span>
              <span>State / Region: <strong>{user?.scope?.regionName || user?.scope?.stateName}</strong></span>
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
            className="btn btn-secondary btn-sm"
            style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
            onClick={() => onNavigate('field-managers')}
          >
            <Users size={16} /> Pincode Managers ({roleSpecificData.totalLowerManagers || 0})
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
              <strong>Division Co-Management:</strong> You and <strong>{coManager.name}</strong> ({coManager.email} • {coManager.mobile}) are the 2 assigned managers co-managing <strong>{user?.scope?.divisionName}</strong>.
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View Division Vendors
          </button>
        </div>
      )}

      {/* 3. Division KPI Widgets */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-title">Assigned Pincodes</div>
            <div className="kpi-value">{roleSpecificData.totalPincodes || 0}</div>
            <div className="kpi-sub">Field postal areas</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0d9488, #2dd4bf)' }}>
            <MapPin size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Pincode Managers</div>
            <div className="kpi-value" style={{ color: '#0d9488' }}>
              {roleSpecificData.totalLowerManagers || 0}
            </div>
            <div className="kpi-sub">Under this Division</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
            <Users size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Division Vendors</div>
            <div className="kpi-value">{statusCounts.total || 0}</div>
            <div className="kpi-sub" style={{ color: '#10b981' }}>
              <TrendingUp size={14} /> {statusCounts.active || 0} Active
            </div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
            <Store size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Pending Approvals</div>
            <div className="kpi-value" style={{ color: '#d97706' }}>
              {(statusCounts.pending || 0) + (statusCounts.underReview || 0)}
            </div>
            <div className="kpi-sub">Requires verification</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Rejected Vendors</div>
            <div className="kpi-value" style={{ color: '#e11d48' }}>{statusCounts.rejected || 0}</div>
            <div className="kpi-sub">KYC rejections</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}>
            <XCircle size={22} />
          </div>
        </div>
      </div>

      {/* 4. Pincode-Wise Coverage and Density */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Pincode Coverage & Density</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Postal sectors within {user?.scope?.divisionName}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('add-vendor')}>
            <PlusCircle size={14} /> Add Vendor in Division
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pincode</th>
                <th>Area / Locality</th>
                <th>Total Vendors</th>
                <th>Active</th>
                <th>Pending / Review</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roleSpecificData.pincodeBreakdown?.map((pin) => (
                <tr key={pin.pincodeId}>
                  <td><strong>PIN {pin.pincodeCode}</strong></td>
                  <td>{pin.areaName}</td>
                  <td><strong>{pin.totalVendors}</strong></td>
                  <td style={{ color: '#15803d' }}>{pin.activeVendors}</td>
                  <td style={{ color: '#b45309' }}>{pin.pendingVendors}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('vendors', { pincodeId: pin.pincodeId })}
                    >
                      Filter Pincode
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Recent Division Activity */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Vendors in Division</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View Directory <ArrowRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Category</th>
                <th>Mobile</th>
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
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('vendor-details', { vendorId: v._id })}
                    >
                      Inspect
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

export default DivisionDashboard;
