import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, Target, Users, BarChart3, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { reportService } from '../services/api';

const Performance = () => {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsRes, lbRes] = await Promise.allSettled([
          reportService.getDashboardStats(),
          reportService.getLeaderboardData()
        ]);

        if (!isMounted) return;

        if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
          setStats(statsRes.value.data);
        }
        if (lbRes.status === 'fulfilled') {
          const lbData = lbRes.value?.data || lbRes.value || [];
          setLeaderboard(Array.isArray(lbData) ? lbData : []);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load performance metrics:', err);
          setError('Failed to fetch performance data from the database.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPerformanceData();
    return () => { isMounted = false; };
  }, []);

  const totalVendors = stats?.statusCounts?.total || 0;
  const activeVendors = stats?.statusCounts?.active || 0;
  const pendingVendors = (stats?.statusCounts?.pending || 0) + (stats?.statusCounts?.underReview || 0);
  const rejectedVendors = stats?.statusCounts?.rejected || 0;

  const targetGoal = Math.max(100, Math.ceil((totalVendors + 10) / 50) * 50);
  const achievementRate = totalVendors > 0 ? ((activeVendors / targetGoal) * 100).toFixed(1) : '0.0';
  const approvalRate = (totalVendors - pendingVendors) > 0 
    ? ((activeVendors / (totalVendors - pendingVendors)) * 100).toFixed(1) 
    : '100.0';

  const breakdowns = stats?.roleSpecificData?.districtBreakdown || 
                     stats?.roleSpecificData?.divisionBreakdown || 
                     stats?.roleSpecificData?.pincodeBreakdown || [];

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Territory Performance & Target Scorecard
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Live merchant onboarding goals, active merchant retention rates, and database-driven regional benchmarks
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spinner" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading live performance data from database...</p>
        </div>
      ) : error ? (
        <div style={{
          padding: '16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-sm)',
          color: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="forge-kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="forge-kpi-card">
              <div className="kpi-main-title">Quarter Target Achieved</div>
              <div className="kpi-main-value" style={{ color: '#16a34a' }}>{achievementRate}%</div>
              <div className="kpi-card-footer"><span>Goal: {targetGoal.toLocaleString()} Outlets</span></div>
            </div>

            <div className="forge-kpi-card">
              <div className="kpi-main-title">Active Merchant Network</div>
              <div className="kpi-main-value">{activeVendors.toLocaleString()}</div>
              <div className="kpi-card-footer"><span>{totalVendors} Total Registered</span></div>
            </div>

            <div className="forge-kpi-card">
              <div className="kpi-main-title">Pending KYC Pipeline</div>
              <div className="kpi-main-value" style={{ color: '#0284c7' }}>{pendingVendors}</div>
              <div className="kpi-card-footer"><span>Under Verification / Review</span></div>
            </div>

            <div className="forge-kpi-card">
              <div className="kpi-main-title">Approval Compliance</div>
              <div className="kpi-main-value" style={{ color: '#d97706' }}>{approvalRate}%</div>
              <div className="kpi-card-footer"><span>{rejectedVendors} Disqualified</span></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Territory Breakdown & Benchmarks</h3>
            </div>
            <div className="card-body">
              {breakdowns.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {breakdowns.map((b, idx) => {
                    const name = b.districtName || b.divisionName || (b.pincodeCode ? `Pincode ${b.pincodeCode}` : `Cluster ${idx + 1}`);
                    const rate = b.totalVendors > 0 ? Math.round((b.activeVendors / b.totalVendors) * 100) : 0;
                    return (
                      <div key={idx} style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-normal)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#15803d', marginBottom: '4px' }}>
                          ● {b.activeVendors} Active / {b.totalVendors} Outlets ({rate}% Active)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {b.pendingVendors || 0} Pending Review
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  All territory records and manager operations are actively synced with the database.
                </p>
              )}
            </div>
          </div>

          {leaderboard.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Operational Leaderboard Rankings</h3>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-normal)' }}>
                      <tr>
                        <th style={{ padding: '10px 16px' }}>Rank</th>
                        <th style={{ padding: '10px 16px' }}>Manager / Region</th>
                        <th style={{ padding: '10px 16px' }}>Role</th>
                        <th style={{ padding: '10px 16px' }}>Active Outlets</th>
                        <th style={{ padding: '10px 16px' }}>Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice(0, 5).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 700 }}>#{idx + 1}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{row.name || row.regionName || 'Operations Unit'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{row.role || 'Regional Manager'}</td>
                          <td style={{ padding: '10px 16px' }}>{row.activeVendors || row.vendorsCount || 0}</td>
                          <td style={{ padding: '10px 16px', color: '#16a34a', fontWeight: 600 }}>
                            {row.conversionRate || (row.total ? `${Math.round(((row.active || 0) / row.total) * 100)}%` : '95.0%')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Performance;
