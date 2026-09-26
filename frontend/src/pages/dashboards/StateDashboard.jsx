import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/api';
import { 
  Building2, 
  Layers, 
  MapPin, 
  Store, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Users,
  ShieldCheck
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const StateDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await reportService.getDashboardStats();
        if (res.success) setStats(res);
      } catch (err) {
        console.error('Failed to load State Dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading State Dashboard...</div>;
  }

  const { statusCounts = {}, roleSpecificData = {}, recentVendors = [] } = stats || {};
  const stateManagersList = roleSpecificData.stateManagersList || [];

  return (
    <div>
      {/* 1. State Command Banner */}
      <div className="dashboard-jurisdiction-banner">
        <div className="jurisdiction-badge">Level 1 • State Agent Command</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="jurisdiction-title">
              State of {roleSpecificData.stateName || user?.scope?.stateName || user?.state || '-'}
            </h2>
            <div className="jurisdiction-subtitle">
              <span>Logged in as <strong>{user?.name}</strong></span>
              <span>•</span>
              <span>Total State Scope: Districts, Divisions, Pincodes, Vendors & Lower Managers</span>
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
            onClick={() => onNavigate('field-managers')}
          >
            <Users size={16} /> View Field Team ({roleSpecificData.totalLowerManagers || 0})
          </button>
        </div>
      </div>

      {/* 2. State-Level Managers Overview Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--primary)" /> State Agent Managers ({stateManagersList.length} Active)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Active State Managers managing {roleSpecificData.stateName}
            </p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {stateManagersList.map((m, idx) => {
              const isCurrent = m.id === user.id;
              return (
                <div 
                  key={m.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: isCurrent ? '#f0fdf4' : '#f8fafc',
                    border: isCurrent ? '1px solid #86efac' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: isCurrent ? '#166534' : 'var(--text-muted)', fontWeight: 700 }}>
                      Manager #{idx + 1} {isCurrent && '(You)'}
                    </span>
                    <span className="status-badge active" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Active</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{m.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.email}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.mobile}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. State KPI Metrics */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-title">Districts in State</div>
            <div className="kpi-value">{roleSpecificData.totalDistricts || 0}</div>
            <div className="kpi-sub">Across {roleSpecificData.stateName}</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}>
            <Building2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Total Divisions</div>
            <div className="kpi-value">{roleSpecificData.totalDivisions || 0}</div>
            <div className="kpi-sub">Operational clusters</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Field Managers</div>
            <div className="kpi-value" style={{ color: '#0ea5e9' }}>
              {roleSpecificData.totalLowerManagers || 0}
            </div>
            <div className="kpi-sub">District, Division & Pincode</div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
            <Users size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">State Vendors</div>
            <div className="kpi-value">{statusCounts.total || 0}</div>
            <div className="kpi-sub" style={{ color: '#10b981' }}>
              <TrendingUp size={14} /> {statusCounts.active || 0} Active
            </div>
          </div>
          <div className="kpi-icon-badge" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
            <Store size={22} />
          </div>
        </div>
      </div>

      {/* 4. District Breakdown Table */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Districts under {roleSpecificData.stateName}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparison across districts</p>
          </div>
          <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('reports')}>
            <FileSpreadsheet size={14} /> Full Analytics
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>District Name</th>
                <th>Total Vendors</th>
                <th>Active</th>
                <th>Pending / Review</th>
                <th>Rejected</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roleSpecificData.districtBreakdown?.map((dist) => (
                <tr key={dist.districtId}>
                  <td style={{ fontWeight: 600 }}>{dist.districtName}</td>
                  <td><strong>{dist.totalVendors}</strong></td>
                  <td style={{ color: '#15803d' }}>{dist.activeVendors}</td>
                  <td style={{ color: '#b45309' }}>{dist.pendingVendors}</td>
                  <td style={{ color: '#b91c1c' }}>{dist.rejectedVendors}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigate('vendors', { districtId: dist.districtId })}
                    >
                      View Vendors
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Recent State-Wide Activity */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Vendor Registrations in {roleSpecificData.stateName}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('vendors')}>
            View All Vendors <ArrowRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                <th>Business Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Date</th>
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

export default StateDashboard;
