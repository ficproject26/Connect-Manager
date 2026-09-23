import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Store, 
  ShoppingBag, 
  Handshake, 
  AlertTriangle, 
  FileText, 
  UserPlus, 
  TrendingUp, 
  BarChart2, 
  CheckCircle, 
  Calendar, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownRight,
  ArrowRight,
  Clock
} from 'lucide-react';

import { reportService } from '../services/api';
import { getIssueStatusCounts } from '../services/issuesData';

const Dashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredIssue, setHoveredIssue] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [leaderboardList, setLeaderboardList] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState('3m'); // '3m' | '6m' | '1y'
  const [territoryFilter, setTerritoryFilter] = useState('pin'); // 'dist' | 'div' | 'pin'
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  // Live Stats fetcher
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardMetrics = async () => {
      try {
        const [res, leadRes] = await Promise.all([
          reportService.getDashboardStats(),
          reportService.getLeaderboardData().catch(() => ({ success: false }))
        ]);
        if (res.success && isMounted) {
          setDashboardData(res);
        }
        if (leadRes.success && Array.isArray(leadRes.data) && isMounted) {
          setLeaderboardList(leadRes.data);
        }
      } catch (err) {
        console.error('Failed to load real dashboard stats:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };
    fetchDashboardMetrics();
    return () => { isMounted = false; };
  }, [user]);

  // Exact KPI Metrics computed from database
  const kpis = dashboardData?.kpiMetrics || {
    totalManagers: 0,
    managersBreakdown: '0 State | 0 District | 0 Division | 0 Pincode',
    totalVendors: 0,
    activeVendors: 0,
    pendingVendors: 0,
    totalShops: 0,
    activeShops: 0,
    inactiveShops: 0,
    totalTieups: 0,
    todayTieups: 0,
    weekTieups: 0,
    verifiedVendors: 0,
    openIssues: 0,
    kycPending: 0,
    vendorRequests: 0
  };

  const statusCounts = dashboardData?.statusCounts || {
    total: 0,
    active: 0,
    pending: 0,
    underReview: 0,
    rejected: 0,
    inactive: 0
  };

  const issueCounts = dashboardData?.issueCounts || getIssueStatusCounts();
  const openCount = issueCounts.open || 0;
  const inProgressCount = issueCounts.inProgress || 0;
  const escalatedCount = issueCounts.escalated || 0;
  const resolvedCount = issueCounts.resolved || 0;
  const totalIssuesCount = issueCounts.total || (openCount + inProgressCount + escalatedCount + resolvedCount) || 0;

  const openPct = totalIssuesCount > 0 ? Math.round((openCount / totalIssuesCount) * 100) : 0;
  const inProgressPct = totalIssuesCount > 0 ? Math.round((inProgressCount / totalIssuesCount) * 100) : 0;
  const escalatedPct = totalIssuesCount > 0 ? Math.round((escalatedCount / totalIssuesCount) * 100) : 0;
  const resolvedPct = totalIssuesCount > 0 ? Math.max(0, 100 - (openPct + inProgressPct + escalatedPct)) : 0;

  // Circumference for r=38 is 238.76
  const C = 238.76;
  const openDash = totalIssuesCount > 0 ? (openCount / totalIssuesCount) * C : 0;
  const inProgDash = totalIssuesCount > 0 ? (inProgressCount / totalIssuesCount) * C : 0;
  const escDash = totalIssuesCount > 0 ? (escalatedCount / totalIssuesCount) * C : 0;
  const resDash = totalIssuesCount > 0 ? (resolvedCount / totalIssuesCount) * C : 0;

  const issueSegments = [
    { id: 'open', label: 'Open', count: openCount, percent: `${openPct}%`, color: '#ef4444', dashArray: `${openDash.toFixed(1)} ${C.toFixed(1)}`, dashOffset: '0' },
    { id: 'progress', label: 'In Progress', count: inProgressCount, percent: `${inProgressPct}%`, color: '#f59e0b', dashArray: `${inProgDash.toFixed(1)} ${C.toFixed(1)}`, dashOffset: `-${openDash.toFixed(1)}` },
    { id: 'escalated', label: 'Escalated', count: escalatedCount, percent: `${escalatedPct}%`, color: '#0284c7', dashArray: `${escDash.toFixed(1)} ${C.toFixed(1)}`, dashOffset: `-${(openDash + inProgDash).toFixed(1)}` },
    { id: 'resolved', label: 'Resolved', count: resolvedCount, percent: `${resolvedPct}%`, color: '#10b981', dashArray: `${resDash.toFixed(1)} ${C.toFixed(1)}`, dashOffset: `-${(openDash + inProgDash + escDash).toFixed(1)}` },
  ];

  // Live Clock updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[d.getDay()];
    const dateNum = String(d.getDate()).padStart(2, '0');
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  };

  const formatTime = (d) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Location Scope Variables derived from user session
  const userName = user?.name || 'Manager';
  const stateName = user?.scope?.stateName || user?.scope?.regionName || user?.state || 'Tamil Nadu';
  const districtName = user?.scope?.districtName;
  const divisionName = user?.scope?.divisionName;
  const pincodeCode = user?.scope?.pincodeCode;
  const isStateManager = (user?.role || '').toLowerCase().includes('state');

  // Dynamic Trend Data
  const trendData = React.useMemo(() => {
    const count = trendPeriod === '1y' ? 12 : trendPeriod === '6m' ? 6 : 3;
    const months = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = d.toLocaleString('en-US', { month: 'short' });
      months.push({
        month: mLabel,
        merchants: 0,
        tieUps: 0,
        barH: 0,
        dotY: 130
      });
    }
    return months;
  }, [trendPeriod]);

  const getTrendCoords = (i, total) => {
    const startX = 46;
    const endX = 336;
    const available = endX - startX;
    const step = available / total;
    const barWidth = total <= 3 ? 32 : total <= 6 ? 18 : 12;
    const barX = startX + i * step + (step - barWidth) / 2;
    const dotX = barX + barWidth / 2;
    return { barX, dotX, barWidth };
  };

  // Dynamic Territories based on manager's assigned scope
  const territoryList = React.useMemo(() => {
    const roleData = dashboardData?.roleSpecificData;
    if (territoryFilter === 'dist' && roleData?.districtBreakdown?.length > 0) {
      return roleData.districtBreakdown.slice(0, 5).map(d => ({
        name: d.districtName,
        value: d.totalVendors || 0,
        percent: d.totalVendors > 0 ? Math.min(100, Math.round((d.totalVendors / (kpis.totalVendors || 1)) * 100)) : 0
      }));
    }
    if (territoryFilter === 'div' && roleData?.divisionBreakdown?.length > 0) {
      return roleData.divisionBreakdown.slice(0, 5).map(div => ({
        name: div.divisionName,
        value: div.totalVendors || 0,
        percent: div.totalVendors > 0 ? Math.min(100, Math.round((div.totalVendors / (kpis.totalVendors || 1)) * 100)) : 0
      }));
    }
    if (territoryFilter === 'pin' && roleData?.pincodeBreakdown?.length > 0) {
      return roleData.pincodeBreakdown.slice(0, 5).map(p => ({
        name: `PIN ${p.pincodeCode || p.pincodeId}`,
        value: p.totalVendors || 0,
        percent: p.totalVendors > 0 ? Math.min(100, Math.round((p.totalVendors / (kpis.totalVendors || 1)) * 100)) : 0
      }));
    }
    if (roleData?.districtBreakdown?.length > 0) {
      return roleData.districtBreakdown.slice(0, 5).map(d => ({
        name: d.districtName,
        value: d.totalVendors || 0,
        percent: 0
      }));
    }
    if (roleData?.divisionBreakdown?.length > 0) {
      return roleData.divisionBreakdown.slice(0, 5).map(div => ({
        name: div.divisionName,
        value: div.totalVendors || 0,
        percent: 0
      }));
    }
    if (roleData?.pincodeBreakdown?.length > 0) {
      return roleData.pincodeBreakdown.slice(0, 5).map(p => ({
        name: `PIN ${p.pincodeCode || p.pincodeId}`,
        value: p.totalVendors || 0,
        percent: 0
      }));
    }
    return [];
  }, [dashboardData, territoryFilter, kpis.totalVendors]);

  // Dynamic Activities from audit logs
  const allActivitiesList = React.useMemo(() => {
    const raw = dashboardData?.recentActivities || [];
    return raw.map((act, idx) => {
      const action = act.action || act.title || 'Activity';
      const isKyc = action.toLowerCase().includes('kyc');
      const isTieup = action.toLowerCase().includes('tieup') || action.toLowerCase().includes('merchant');
      const isIssue = action.toLowerCase().includes('issue') || action.toLowerCase().includes('escalat');
      const isReport = action.toLowerCase().includes('report');
      
      const category = isKyc ? 'kyc' : isTieup ? 'tieup' : isIssue ? 'escalation' : isReport ? 'report' : 'vendor';
      const icon = isKyc ? CheckCircle : isTieup ? Handshake : isIssue ? AlertTriangle : isReport ? FileText : UserPlus;
      const bg = isKyc ? '#dcfce7' : isTieup ? '#fef3c7' : isIssue ? '#fee2e2' : isReport ? '#ede9fe' : '#e0f2fe';
      const color = isKyc ? '#16a34a' : isTieup ? '#d97706' : isIssue ? '#dc2626' : isReport ? '#7c3aed' : '#0284c7';

      return {
        id: act._id || act.id || idx + 1,
        category,
        title: action,
        sub: act.details || act.description || act.entity || 'Audit record',
        time: act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        icon,
        bg,
        color,
        tag: action
      };
    });
  }, [dashboardData]);

  const filteredActivities = allActivitiesList.filter(act => {
    if (activityFilter !== 'all' && act.category !== activityFilter) return false;
    return true;
  });

  // Dynamic Top Performing Managers from live database leaderboard
  const topManagers = React.useMemo(() => {
    return leaderboardList.slice(0, 5).map(m => ({
      id: m.rank || m.id,
      name: m.name,
      level: m.roleLabel || m.level,
      territory: m.territory,
      vendors: m.vendorsOnboarded || 0,
      tieups: m.activeVendors || 0,
      status: m.rating || 'Active',
      statusClass: (m.rating || 'steady').toLowerCase(),
      avatarBg: m.avatarBg || '#0284c7'
    }));
  }, [leaderboardList]);

  return (
    <div>
      {/* 1. Hero Welcome & Jurisdiction Banner Card */}
      <section aria-label="Jurisdiction banner" className="hero-welcome-card">
        {/* Panoramic Temple Watermark on Right */}
        <div 
          className="hero-watermark-overlay" 
          style={{ backgroundImage: `url('/assets/temple_watermark.jpg')` }}
        />
        
        <div className="hero-top-row">
          <div>
            <h1 className="hero-greeting-title">
              Good Morning, <span className="hero-greeting-name">{userName}!</span>
            </h1>
            <p className="hero-greeting-sub">
              Let's build a stronger {stateName} together.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="hero-quote-box">
              “ Connecting Businesses <br />Creating Opportunities ”
            </div>
            
            {/* Date & Time Box */}
            <div className="hero-datetime-box">
              <Calendar size={18} style={{ color: 'var(--forge-gold)' }} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatDate(currentTime)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatTime(currentTime)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Location Scope Breadcrumb Pill Chain */}
        <div className="hero-bottom-row">
          <div className="location-scope-chain">
            <div className="location-chain-item" onClick={() => onNavigate('reports')}>
              <MapPin size={13} style={{ color: 'var(--forge-gold)' }} />
              <span>{stateName} (State)</span>
            </div>
            {!isStateManager && districtName && (
              <>
                <span className="location-chain-sep">››</span>
                <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
                  <span>{districtName}</span>
                </div>
              </>
            )}
            {!isStateManager && divisionName && (
              <>
                <span className="location-chain-sep">››</span>
                <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
                  <span>{divisionName}</span>
                </div>
              </>
            )}
            {!isStateManager && pincodeCode && (
              <>
                <span className="location-chain-sep">››</span>
                <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
                  <span>PIN {pincodeCode}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. 8-Card Metric KPI Grid (4x2) */}
      <section aria-label="Key Performance Indicators" className="forge-kpi-grid">
        {/* KPI 1: Total Managers */}
        <div className="forge-kpi-card" onClick={() => onNavigate('field-managers')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <Users size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Total Managers</div>
                <div className="kpi-main-value">{kpis.totalManagers}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="kpi-trend-pill kpi-trend-up">
                <ArrowUpRight size={12} /> 7.7%
              </span>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '2px' }}>vs last month</div>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Vendors */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendors')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#d1fae5', color: '#059669' }}>
                <Store size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Total Vendors</div>
                <div className="kpi-main-value">{kpis.totalVendors.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="kpi-trend-pill kpi-trend-up">
                <ArrowUpRight size={12} /> 12.4%
              </span>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '2px' }}>vs last month</div>
            </div>
          </div>
          <div className="kpi-card-footer">
            <span>{kpis.activeVendors.toLocaleString()} Active | {kpis.pendingVendors.toLocaleString()} Pending</span>
          </div>
        </div>

        {/* KPI 3: Total Shops / Outlets */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendors')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                <ShoppingBag size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Active Outlets</div>
                <div className="kpi-main-value">{kpis.totalShops.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="kpi-trend-pill kpi-trend-up">
                <ArrowUpRight size={12} /> 9.1%
              </span>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '2px' }}>vs last month</div>
            </div>
          </div>
          <div className="kpi-card-footer">
            <span>{kpis.activeShops.toLocaleString()} Active | {kpis.inactiveShops.toLocaleString()} Inactive</span>
          </div>
        </div>

        {/* KPI 4: Total Onboardings */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendors')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#b45309' }}>
                <Handshake size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Onboarded Vendors</div>
                <div className="kpi-main-value">{kpis.totalTieups.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="kpi-trend-pill kpi-trend-up">
                <ArrowUpRight size={12} /> 15.3%
              </span>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '2px' }}>vs last month</div>
            </div>
          </div>
          <div className="kpi-card-footer">
            <span>{kpis.todayTieups} Today | {kpis.weekTieups} This Week</span>
          </div>
        </div>

        {/* KPI 5: Verified Merchants */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendors')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Verified Merchants</div>
                <div className="kpi-main-value">{kpis.verifiedVendors || kpis.activeVendors}</div>
              </div>
            </div>
            <span className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={12} /> 18.6%
            </span>
          </div>
          <div className="kpi-card-footer">
            <span>100% KYC & Inspection Passed</span>
          </div>
        </div>

        {/* KPI 6: Open Issues */}
        <div className="forge-kpi-card" onClick={() => onNavigate('tasks')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Active Tasks</div>
                <div className="kpi-main-value">{kpis.openIssues}</div>
              </div>
            </div>
            <span className="kpi-trend-pill kpi-trend-down">
              <ArrowDownRight size={12} /> 6.7%
            </span>
          </div>
        </div>

        {/* KPI 7: KYC Pending */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendor-requests')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <FileText size={18} />
              </div>
              <div>
                <div className="kpi-main-title">KYC Pending</div>
                <div className="kpi-main-value">{kpis.kycPending}</div>
              </div>
            </div>
            <span className="kpi-trend-pill kpi-trend-down">
              <ArrowDownRight size={12} /> 10.4%
            </span>
          </div>
        </div>

        {/* KPI 8: Vendor Requests */}
        <div className="forge-kpi-card" onClick={() => onNavigate('vendor-requests')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <UserPlus size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Vendor Requests</div>
                <div className="kpi-main-value">{kpis.vendorRequests}</div>
              </div>
            </div>
            <span className="kpi-trend-pill kpi-trend-up">
              <ArrowUpRight size={12} /> 21.3%
            </span>
          </div>
        </div>
      </section>

      {/* 3. Middle Analytics Row (3 Columns) */}
      <div className="middle-analytics-grid">
        {/* Card 1: Merchant & Tie-ups Trend */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <TrendingUp size={16} style={{ color: 'var(--forge-gold)' }} />
              Merchant & Tie-ups Trend
            </div>
            <select aria-label="Filter trend by time period" className="analytics-select" defaultValue="6m">
              <option value="6m">Last 6 Months</option>
              <option value="3m">Last 3 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color-box" style={{ background: '#facc15' }}></span>
              <span>New Merchants</span>
            </div>
            <div className="legend-item">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
              <span>Tie-ups</span>
            </div>
          </div>

          {/* SVG Dual-Axis Chart */}
          <div className="chart-container">
            <svg width="100%" height="100%" viewBox="0 0 380 160" preserveAspectRatio="none">
              {/* Horizontal Grid Lines */}
              <line x1="36" y1="18" x2="344" y2="18" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="36" y1="46" x2="344" y2="46" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="36" y1="74" x2="344" y2="74" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="36" y1="102" x2="344" y2="102" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="36" y1="130" x2="344" y2="130" stroke="#e2e8f0" strokeWidth="1" />

              {/* Y Axis Left labels: Merchants */}
              <text x="30" y="22" fontSize="8" fill="#94a3b8" textAnchor="end">100</text>
              <text x="30" y="50" fontSize="8" fill="#94a3b8" textAnchor="end">80</text>
              <text x="30" y="78" fontSize="8" fill="#94a3b8" textAnchor="end">60</text>
              <text x="30" y="106" fontSize="8" fill="#94a3b8" textAnchor="end">40</text>
              <text x="30" y="133" fontSize="8" fill="#94a3b8" textAnchor="end">0</text>

              {/* Y Axis Right labels: Tie-ups */}
              <text x="350" y="22" fontSize="8" fill="#94a3b8" textAnchor="start">1,000</text>
              <text x="350" y="50" fontSize="8" fill="#94a3b8" textAnchor="start">800</text>
              <text x="350" y="78" fontSize="8" fill="#94a3b8" textAnchor="start">600</text>
              <text x="350" y="106" fontSize="8" fill="#94a3b8" textAnchor="start">400</text>
              <text x="350" y="133" fontSize="8" fill="#94a3b8" textAnchor="start">0</text>

              {/* Bars: Merchants (Golden Yellow) */}
              {trendData.map((d, i) => {
                const { barX, barWidth } = getTrendCoords(i, trendData.length);
                const y = 130 - d.barH;
                return (
                  <rect
                    key={d.month}
                    x={barX}
                    y={y}
                    width={barWidth}
                    height={d.barH}
                    rx="3"
                    fill="#facc15"
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    <title>{`${d.month}: ${d.merchants} New Merchants`}</title>
                  </rect>
                );
              })}

              {/* Line: Tie-ups (Blue) */}
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'all 0.3s ease' }}
                points={trendData.map((d, i) => {
                  const { dotX } = getTrendCoords(i, trendData.length);
                  return `${dotX},${d.dotY}`;
                }).join(' ')}
              />

              {/* Dots: Tie-ups */}
              {trendData.map((d, i) => {
                const { dotX } = getTrendCoords(i, trendData.length);
                return (
                  <circle
                    key={`dot-${d.month}`}
                    cx={dotX}
                    cy={d.dotY}
                    r={trendData.length > 6 ? "2.5" : "3.5"}
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    <title>{`${d.month}: ${d.tieUps} Tie-ups`}</title>
                  </circle>
                );
              })}

              {/* X Axis Month Labels */}
              {trendData.map((d, i) => {
                const { dotX } = getTrendCoords(i, trendData.length);
                return (
                  <text
                    key={`label-${d.month}`}
                    x={dotX}
                    y="148"
                    fontSize={trendData.length > 6 ? "7.5" : "8.5"}
                    fill="#64748b"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {d.month}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Card 2: Territory Performance */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <BarChart2 size={16} style={{ color: 'var(--forge-gold)' }} />
              Territory Performance
            </div>
            <select 
              aria-label="Filter territory performance" 
              className="analytics-select" 
              value={territoryFilter}
              onChange={(e) => setTerritoryFilter(e.target.value)}
            >
              <option value="dist">Districts</option>
              <option value="div">Divisions</option>
              <option value="pin">Pincodes</option>
            </select>
          </div>

          <div className="territory-bars-list">
            {territoryList.length > 0 ? (
              territoryList.map((item) => (
                <div key={item.name} className="territory-bar-item">
                  <span className="territory-name" title={item.name}>{item.name}</span>
                  <div className="territory-progress-track">
                    <div 
                      className="territory-progress-fill" 
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <span className="territory-val">{item.value}</span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No territory data recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Today's Activities */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <Users size={16} style={{ color: 'var(--forge-gold)' }} />
              Today's Activities
            </div>
            <button
              className="btn-link"
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setIsActivitiesModalOpen(true)}
            >
              View All
            </button>
          </div>

          <div className="activities-timeline">
            {allActivitiesList.length > 0 ? (
              allActivitiesList.slice(0, 5).map((act) => {
                const IconComponent = act.icon;
                return (
                  <div key={act.id} className="activity-item">
                    <div className="activity-icon-node" style={{ background: act.bg, color: act.color }}>
                      <IconComponent size={14} />
                    </div>
                    <div className="activity-text-content">
                      <div className="activity-title">{act.title}</div>
                      <div className="activity-sub">{act.sub}</div>
                    </div>
                    <span className="activity-time">{act.time}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No recent activities recorded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Row (3 Columns) */}
      <div className="bottom-analytics-grid">
        {/* Card 1: Top Performing Managers Table */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <span style={{ fontSize: '1rem' }}>🏆</span>
              Top Performing Managers
            </div>
            <button
              className="btn-link"
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => onNavigate('leaderboard')}
            >
              View All
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="forge-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Manager</th>
                  <th>Level</th>
                  <th>Territory</th>
                  <th>Vendors</th>
                  <th>Tie-ups</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topManagers.length > 0 ? (
                  topManagers.map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: '#94a3b8', fontWeight: 600 }}>{m.id}</td>
                      <td>
                        <span className="manager-avatar-mini" style={{ background: m.avatarBg, color: 'white' }}>
                          {(m.name || 'M').slice(0, 1)}
                        </span>
                        <strong>{m.name}</strong>
                      </td>
                      <td>{m.level}</td>
                      <td>{m.territory}</td>
                      <td><strong>{m.vendors}</strong></td>
                      <td>{m.tieups}</td>
                      <td>
                        <span className={`perf-badge ${m.statusClass}`}>
                          ● {m.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No manager rankings recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 2: Issue Status Donut Chart */}
        <div className="analytics-card issue-status-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <AlertTriangle size={16} style={{ color: 'var(--forge-gold)' }} />
              Issue Status
            </div>
            <select aria-label="Filter issue status by time period" className="analytics-select" defaultValue="month">
              <option value="month">This Month</option>
              <option value="week">This Week</option>
              <option value="year">This Year</option>
            </select>
          </div>

          <div className="donut-chart-container">
            <div className="donut-svg-wrap">
              <svg className="donut-svg" width="150" height="150" viewBox="0 0 100 100">
                {issueSegments.map((seg) => {
                  const isHovered = hoveredIssue === seg.id;
                  return (
                    <circle
                      key={seg.id}
                      className={`donut-slice ${isHovered ? 'active' : ''}`}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHovered ? 15 : 12}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      onMouseEnter={() => setHoveredIssue(seg.id)}
                      onMouseLeave={() => setHoveredIssue(null)}
                    />
                  );
                })}
              </svg>
              <div className="donut-center-text">
                <div 
                  className="donut-center-num" 
                  style={{ color: hoveredIssue ? issueSegments.find(s => s.id === hoveredIssue)?.color : 'var(--text-main)' }}
                >
                  {hoveredIssue ? issueSegments.find(s => s.id === hoveredIssue)?.count : totalIssuesCount}
                </div>
                <div className="donut-center-sub">
                  {hoveredIssue ? (
                    <>
                      <div className="donut-sub-label">{issueSegments.find(s => s.id === hoveredIssue)?.label}</div>
                      <div className="donut-sub-pct">({issueSegments.find(s => s.id === hoveredIssue)?.percent})</div>
                    </>
                  ) : (
                    <div className="donut-sub-label">Total Issues</div>
                  )}
                </div>
              </div>
            </div>

            <div className="donut-legend-list">
              {issueSegments.map((seg) => {
                const isHovered = hoveredIssue === seg.id;
                return (
                  <div 
                    key={seg.id} 
                    className={`donut-legend-row ${isHovered ? 'active' : ''}`}
                    onMouseEnter={() => setHoveredIssue(seg.id)}
                    onMouseLeave={() => setHoveredIssue(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="donut-legend-dot" style={{ background: seg.color }} />
                      <span style={{ fontWeight: isHovered ? 700 : 500 }}>{seg.label}</span>
                    </div>
                    <strong>{seg.count}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Issue Health & Quick Action Bottom Section to fill gap cleanly */}
          <div className="donut-card-bottom">
            <div className="issue-health-row">
              <div className="issue-health-label">
                <span>Resolution SLA Rate</span>
                <strong style={{ color: '#10b981' }}>{resolvedPct}% SLA Met</strong>
              </div>
              <div className="issue-health-bar">
                <div className="issue-health-fill" style={{ width: `${Math.max(15, resolvedPct)}%` }} />
              </div>
            </div>

            <div className="issue-quick-stats">
              <div className="issue-stat-box">
                <div className="stat-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <Clock size={13} />
                </div>
                <div>
                  <span className="stat-label">Avg Turnaround</span>
                  <span className="stat-value">3.5 hrs</span>
                </div>
              </div>
              <div className="issue-stat-box">
                <div className="stat-icon-wrap" style={{ background: '#fef2f2', color: '#ef4444' }}>
                  <AlertTriangle size={13} />
                </div>
                <div>
                  <span className="stat-label">Escalated</span>
                  <span className="stat-value" style={{ color: '#ef4444' }}>{escalatedCount} Urgent</span>
                </div>
              </div>
            </div>

            <button 
              className="btn-view-issues"
              onClick={() => onNavigate && onNavigate('tasks')}
            >
              <span>View & Manage Tasks</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Card 3: Community Promo Banner */}
        <div className="community-promo-card">
          <div>
            <div className="promo-tag">
              <span style={{ fontSize: '0.95rem' }}>🏛️</span> Together for a Stronger India
            </div>
            <div className="promo-headline">
              Empowering Local Business
            </div>
            <div className="promo-subtext">
              Building a Brighter Tomorrow
            </div>
          </div>

          <div className="promo-img-wrapper">
            <img 
              src="/assets/community_banner_v2.jpg" 
              alt="Together for a Stronger India" 
              className="promo-img"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>

          <button 
            className="promo-btn"
            onClick={() => onNavigate('vendors')}
          >
            <span>Let's Connect!</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
      {/* Activities Timeline Modal */}
      {isActivitiesModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div
            onClick={() => setIsActivitiesModalOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 22, 40, 0.72)',
              backdropFilter: 'blur(6px)'
            }}
          />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 620,
            maxHeight: 'min(90vh, 760px)',
            background: '#ffffff',
            borderRadius: 18,
            boxShadow: '0 25px 70px rgba(0,0,0,0.3)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px 14px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7'
                }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Today's & Recent Activities
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                    Live operational activity ledger for {stateName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActivitiesModalOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: 18
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div style={{
              padding: '12px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              background: '#ffffff'
            }}>
              {[
                { id: 'all', label: 'All Activities' },
                { id: 'vendor', label: 'Vendors' },
                { id: 'kyc', label: 'KYC' },
                { id: 'tieup', label: 'Tie-ups' },
                { id: 'escalation', label: 'Escalations' },
                { id: 'report', label: 'Reports' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActivityFilter(cat.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: activityFilter === cat.id ? '1px solid #0284c7' : '1px solid #e2e8f0',
                    background: activityFilter === cat.id ? '#0284c7' : '#f8fafc',
                    color: activityFilter === cat.id ? '#ffffff' : '#64748b',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Activities Timeline List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredActivities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No activities found for this category.
                  </div>
                ) : (
                  filteredActivities.map(act => {
                    const IconComponent = act.icon;
                    return (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          paddingBottom: 12,
                          borderBottom: '1px solid #f1f5f9'
                        }}
                      >
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: act.bg,
                          color: act.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <IconComponent size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                              {act.title}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {act.time}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                            {act.sub}
                          </div>
                          <span style={{
                            display: 'inline-block',
                            marginTop: 4,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: act.bg,
                            color: act.color
                          }}>
                            {act.tag}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => {
                  setIsActivitiesModalOpen(false);
                  if (onNavigate) onNavigate('audit-logs');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Open Compliance Audit Log →
              </button>
              <button
                type="button"
                onClick={() => setIsActivitiesModalOpen(false)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default Dashboard;
