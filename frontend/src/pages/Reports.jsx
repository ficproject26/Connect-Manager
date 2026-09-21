import React, { useState, useEffect } from 'react';
import { reportService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Download, 
  BarChart3, 
  PieChart, 
  MapPin, 
  Filter, 
  CheckCircle2, 
  Clock, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const Reports = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [reportVendors, setReportVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [dashRes, vendRes] = await Promise.all([
          reportService.getDashboardStats(),
          reportService.getVendorReportData()
        ]);
        if (dashRes.success) setDashboardData(dashRes);
        if (vendRes.success) setReportVendors(vendRes.data);
      } catch (err) {
        console.error('Failed to load report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const exportCSV = () => {
    if (!reportVendors.length) return;

    const headers = ['Vendor ID', 'Business Name', 'Owner Name', 'Mobile', 'Category', 'Status', 'District', 'Division', 'Pincode', 'Registration Date'];
    const rows = reportVendors.map(v => [
      v.id,
      `"${v.businessName}"`,
      `"${v.name}"`,
      v.mobile,
      `"${v.category}"`,
      v.status,
      `"${v.district}"`,
      `"${v.division}"`,
      v.pincode,
      v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vendor_report_${user?.role}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Compiling scoped reports...</div>;
  }

  const { statusCounts = {}, categoryCounts = {}, roleSpecificData = {} } = dashboardData || {};

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Geographic Branch Reports</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Analytical reports strictly constrained to your assigned branch ({reportVendors.length} total vendors)
          </p>
        </div>
        <button className="btn btn-primary" onClick={exportCSV} disabled={reportVendors.length === 0}>
          <Download size={16} /> Export to CSV
        </button>
      </div>

      {/* Status Distribution Summary */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--primary)" /> Vendor Status Summary
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Registered</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {statusCounts.total || 0}
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#ecfdf5', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Active (Verified)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {statusCounts.active || 0}
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#fef3c7', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Pending Onboarding</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {statusCounts.pending || 0}
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Under Review</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>
                {statusCounts.underReview || 0}
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#fee2e2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>Rejected</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
                {statusCounts.rejected || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#0ea5e9" /> Category Representation
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = Math.round((count / (statusCounts.total || 1)) * 100);
              return (
                <div key={cat} style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span>{cat}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scoped Vendor Listing for Report */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Export Data Preview</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Category</th>
                <th>District</th>
                <th>Division</th>
                <th>Pincode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportVendors.slice(0, 15).map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.businessName}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.name}</div>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.district}</td>
                  <td>{v.division}</td>
                  <td>PIN {v.pincode}</td>
                  <td><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
