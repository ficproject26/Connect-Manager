import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/api';
import { 
  Layers, 
  MapPin, 
  Store, 
  TrendingUp, 
  ArrowRight,
  Clock,
  Users
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const DistrictDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await reportService.getDashboardStats();
        if (res.success) setStats(res);
      } catch (err) {
        console.error('Failed to load District Dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading District Dashboard...</div>;
  }

  const { statusCounts = {}, roleSpecificData = {}, recentVendors = [] } = stats || {};
  const coManager = roleSpecificData.coManager;

  return (
    <div>
      {/* 1. District Jurisdiction Banner */}
      <div className="dashboard-jurisdiction-banner" style={{ background: 'linear-gradient(135deg, #0c4a6e, #0284c7, #1e293b)' }}>
        <div className="jurisdiction-badge" style={{ color: '#bae6fd', background: 'rgba(255,255,255,0.18)' }}>
          Level 2 • District Operations Hub (2 Managers)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="jurisdiction-title">District: {user?.scope?.districtName || 'Bengaluru Urban'}</h2>
            <div className="jurisdiction-subtitle">
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
            <Users size={16} /> Division & Pincode Managers ({roleSpecificData.totalLowerManagers || 0})
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
              <strong>District Co-Management:</strong> You and <strong>{coManager.name}</strong> ({coManager.email} • {coManager.mobile}) are the 2 assigned managers co-managing <strong>{user?.scope?.districtName}</strong>.
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View District Vendors
          </button>
        </div>
      )}

      {/* 3. District KPI Widgets */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-title">Assigned Divisions</div>
            <div className="kpi-value">{roleSpecificData.totalDivisions || 0}</div>
            <div className="kpi-sub">Inside this district</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Active Pincodes</div>
            <div className="kpi-value">{roleSpecificData.totalPincodes || 0}</div>
            <div className="kpi-sub">Field postal clusters</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
            <MapPin size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Field Managers</div>
            <div className="kpi-value" style={{ color: '#0284c7' }}>
              {roleSpecificData.totalLowerManagers || 0}
            </div>
            <div className="kpi-sub">Division & Pincode</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
            <Users size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">District Vendors</div>
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
            <div className="kpi-sub">Awaiting verification</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* 4. Division-Wise Performance Cards */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Division Overview & Performance</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparison across Divisions within {user?.scope?.districtName}</p>
          </div>
          <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('vendors')}>
            View All District Vendors
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Division Name</th>
                <th>Total Vendors</th>
                <th>Active</th>
                <th>Pending / Review</th>
                <th>Rejected</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roleSpecificData.divisionBreakdown?.map((div) => (
                <tr key={div.divisionId}>
                  <td style={{ fontWeight: 600 }}>{div.divisionName}</td>
                  <td><strong>{div.totalVendors}</strong></td>
                  <td style={{ color: '#15803d' }}>{div.activeVendors}</td>
                  <td style={{ color: '#b45309' }}>{div.pendingVendors}</td>
                  <td style={{ color: '#b91c1c' }}>{div.rejectedVendors}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('vendors', { divisionId: div.divisionId })}
                    >
                      Filter Division
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Recent District Activity */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Vendors Registered in District</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View Directory <ArrowRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                <th>Business Name</th>
                <th>Category</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {recentVendors.map((v, index) => (
                <tr key={v._id}>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>
                    {index + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.businessName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.name}</div>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.mobile}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(v.createdAt).toLocaleDateString()}
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

export default DistrictDashboard;
