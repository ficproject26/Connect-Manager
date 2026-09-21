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
  const [loadingStats, setLoadingStats] = useState(true);

  // Live Stats fetcher
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardMetrics = async () => {
      try {
        const res = await reportService.getDashboardStats();
        if (res.success && isMounted) {
          setDashboardData(res);
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
    totalManagers: 10,
    managersBreakdown: '4 State | 2 District | 2 Division | 2 Pincode',
    totalVendors: 7,
    activeVendors: 4,
    pendingVendors: 2,
    totalShops: 7,
    activeShops: 4,
    inactiveShops: 3,
    totalTieups: 4,
    todayTieups: 1,
    weekTieups: 3,
    verifiedVendors: 4,
    openIssues: 3,
    kycPending: 2,
    vendorRequests: 1
  };

  const statusCounts = dashboardData?.statusCounts || {
    total: 7,
    active: 4,
    pending: 1,
    underReview: 1,
    rejected: 1,
    inactive: 1
  };

  const issueCounts = dashboardData?.issueCounts || getIssueStatusCounts();
  const openCount = issueCounts.open;
  const inProgressCount = issueCounts.inProgress;
  const escalatedCount = issueCounts.escalated;
  const resolvedCount = issueCounts.resolved;
  const totalIssuesCount = issueCounts.total || (openCount + inProgressCount + escalatedCount + resolvedCount) || 1;

  const openPct = Math.round((openCount / totalIssuesCount) * 100);
  const inProgressPct = Math.round((inProgressCount / totalIssuesCount) * 100);
  const escalatedPct = Math.round((escalatedCount / totalIssuesCount) * 100);
  const resolvedPct = Math.max(0, 100 - (openPct + inProgressPct + escalatedPct));

  // Circumference for r=38 is 238.76
  const C = 238.76;
  const openDash = (openCount / totalIssuesCount) * C;
  const inProgDash = (inProgressCount / totalIssuesCount) * C;
  const escDash = (escalatedCount / totalIssuesCount) * C;
  const resDash = (resolvedCount / totalIssuesCount) * C;

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
  const stateName = user?.scope?.stateName || user?.scope?.regionName || 'Karnataka';
  const districtName = user?.scope?.districtName;
  const divisionName = user?.scope?.divisionName;
  const pincodeCode = user?.scope?.pincodeCode;

  // Trend Data for 6 months
  const trendData = [
    { month: 'Jan', merchants: 45, tieUps: 320, barH: 52, dotY: 104 },
    { month: 'Feb', merchants: 52, tieUps: 450, barH: 62, dotY: 88 },
    { month: 'Mar', merchants: 64, tieUps: 580, barH: 76, dotY: 72 },
    { month: 'Apr', merchants: 75, tieUps: 670, barH: 88, dotY: 60 },
    { month: 'May', merchants: 88, tieUps: 810, barH: 104, dotY: 42 },
    { month: 'Jun', merchants: 100, tieUps: 940, barH: 118, dotY: 26 }
  ];

  // Dynamic Territories based on manager's assigned state & district
  const territoryList = React.useMemo(() => {
    if (districtName === 'Mysuru') {
      return [
        { name: 'Mysuru Urban', value: 712, percent: 92 },
        { name: 'Devaraja Market', value: 620, percent: 80 },
        { name: 'Gokulam', value: 584, percent: 76 },
        { name: 'Vijayanagar', value: 512, percent: 68 },
        { name: 'Kuwempunagar', value: 486, percent: 64 }
      ];
    }
    if (districtName === 'Bengaluru Urban') {
      return [
        { name: 'Bengaluru South', value: 850, percent: 95 },
        { name: 'Bengaluru Central', value: 712, percent: 88 },
        { name: 'Koramangala (560034)', value: 620, percent: 80 },
        { name: 'HSR Layout (560095)', value: 584, percent: 76 },
        { name: 'MG Road (560001)', value: 512, percent: 68 }
      ];
    }
    if (stateName === 'Karnataka') {
      return [
        { name: 'Bengaluru Urban', value: 850, percent: 95 },
        { name: 'Mysuru', value: 712, percent: 88 },
        { name: 'Belagavi', value: 620, percent: 80 },
        { name: 'Mangaluru', value: 584, percent: 76 },
        { name: 'Hubballi-Dharwad', value: 512, percent: 68 }
      ];
    }
    if (stateName === 'Maharashtra') {
      return [
        { name: 'Mumbai Urban', value: 890, percent: 96 },
        { name: 'Pune', value: 740, percent: 89 },
        { name: 'Nagpur', value: 610, percent: 78 },
        { name: 'Thane', value: 550, percent: 72 },
        { name: 'Nashik', value: 490, percent: 65 }
      ];
    }
    return [
      { name: `${stateName} East`, value: 712, percent: 92 },
      { name: `${stateName} West`, value: 620, percent: 80 },
      { name: `${stateName} North`, value: 584, percent: 76 },
      { name: `${stateName} South`, value: 512, percent: 68 },
      { name: `${stateName} Central`, value: 486, percent: 64 }
    ];
  }, [stateName, districtName]);

  // Dynamic Top Performing Managers matching manager's jurisdiction
  const topManagers = React.useMemo(() => {
    if (stateName === 'Karnataka') {
      return [
        { id: 1, name: 'Priya Rao', level: 'District', territory: 'Bengaluru Urban', vendors: 312, tieups: 94, status: 'Excellent', statusClass: 'excellent', avatarBg: '#0284c7' },
        { id: 2, name: 'Vikram Kumar', level: 'Division', territory: 'Bengaluru South', vendors: 245, tieups: 78, status: 'Excellent', statusClass: 'excellent', avatarBg: '#8b5cf6' },
        { id: 3, name: 'Ananya Desai', level: 'Pincode', territory: '560034 Koramangala', vendors: 198, tieups: 64, status: 'Good', statusClass: 'good', avatarBg: '#0d9488' },
        { id: 4, name: 'Ramesh Sen', level: 'District', territory: 'Bengaluru Urban', vendors: 160, tieups: 52, status: 'Good', statusClass: 'good', avatarBg: '#ea580c' },
        { id: 5, name: 'Arjun Somnath', level: 'District', territory: 'Mysuru', vendors: 142, tieups: 48, status: 'Average', statusClass: 'average', avatarBg: '#d97706' }
      ];
    }
    if (stateName === 'Maharashtra') {
      return [
        { id: 1, name: 'Devendra Patil', level: 'State', territory: 'Maharashtra', vendors: 410, tieups: 110, status: 'Excellent', statusClass: 'excellent', avatarBg: '#0284c7' },
        { id: 2, name: 'Aarav Mehta', level: 'District', territory: 'Mumbai Urban', vendors: 290, tieups: 85, status: 'Excellent', statusClass: 'excellent', avatarBg: '#8b5cf6' },
        { id: 3, name: 'Siddharth Pawar', level: 'Division', territory: 'Pune Central', vendors: 210, tieups: 68, status: 'Good', statusClass: 'good', avatarBg: '#0d9488' },
        { id: 4, name: 'Neha Kulkarni', level: 'Pincode', territory: '400001', vendors: 175, tieups: 55, status: 'Good', statusClass: 'good', avatarBg: '#ea580c' },
        { id: 5, name: 'Rajesh Shinde', level: 'District', territory: 'Thane', vendors: 130, tieups: 40, status: 'Average', statusClass: 'average', avatarBg: '#d97706' }
      ];
    }
    return [
      { id: 1, name: 'S. Aravind', level: 'District', territory: `${stateName} Central`, vendors: 245, tieups: 78, status: 'Excellent', statusClass: 'excellent', avatarBg: '#0284c7' },
      { id: 2, name: 'M. Priya', level: 'Division', territory: `${stateName} Division A`, vendors: 198, tieups: 64, status: 'Good', statusClass: 'good', avatarBg: '#8b5cf6' },
      { id: 3, name: 'K. Dinesh', level: 'Pincode', territory: `${stateName} Division B`, vendors: 160, tieups: 52, status: 'Good', statusClass: 'good', avatarBg: '#0d9488' },
      { id: 4, name: 'R. Kavitha', level: 'District', territory: `${stateName} North`, vendors: 312, tieups: 94, status: 'Excellent', statusClass: 'excellent', avatarBg: '#ea580c' },
      { id: 5, name: 'V. Saravanan', level: 'Pincode', territory: `${stateName} Division C`, vendors: 142, tieups: 48, status: 'Average', statusClass: 'average', avatarBg: '#d97706' }
    ];
  }, [stateName]);

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
            <span className="location-chain-sep">››</span>
            <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
              <span>{districtName || 'All Districts'}</span>
            </div>
            <span className="location-chain-sep">››</span>
            <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
              <span>{divisionName || 'All Divisions'}</span>
            </div>
            <span className="location-chain-sep">››</span>
            <div className="location-chain-item" onClick={() => onNavigate('vendors')}>
              <span>{pincodeCode ? `PIN ${pincodeCode}` : 'All Pincodes'}</span>
            </div>
            <span className="location-chain-sep" style={{ color: '#94a3b8' }}>›</span>
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
        <div className="forge-kpi-card" onClick={() => onNavigate('issues')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="kpi-main-title">Open Issues</div>
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
                const x = 50 + i * 50;
                const y = 130 - d.barH;
                return (
                  <rect
                    key={d.month}
                    x={x}
                    y={y}
                    width="18"
                    height={d.barH}
                    rx="3"
                    fill="#facc15"
                  />
                );
              })}

              {/* Line: Tie-ups (Blue) */}
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trendData.map((d, i) => {
                  const x = 50 + i * 50 + 9;
                  return `${x},${d.dotY}`;
                }).join(' ')}
              />

              {/* Dots: Tie-ups */}
              {trendData.map((d, i) => {
                const x = 50 + i * 50 + 9;
                return (
                  <circle
                    key={`dot-${d.month}`}
                    cx={x}
                    cy={d.dotY}
                    r="3.5"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* X Axis Month Labels */}
              {trendData.map((d, i) => {
                const x = 50 + i * 50 + 9;
                return (
                  <text
                    key={`label-${d.month}`}
                    x={x}
                    y="148"
                    fontSize="8.5"
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
            <select aria-label="Filter territory performance" className="analytics-select" defaultValue="dist">
              <option value="dist">Districts</option>
              <option value="div">Divisions</option>
              <option value="pin">Pincodes</option>
            </select>
          </div>

          <div className="territory-bars-list">
            {territoryList.map((item) => (
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
            ))}
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
              onClick={() => onNavigate('audit-logs')}
            >
              View All
            </button>
          </div>

          <div className="activities-timeline">
            <div className="activity-item">
              <div className="activity-icon-node" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <UserPlus size={14} />
              </div>
              <div className="activity-text-content">
                <div className="activity-title">New vendor request received</div>
                <div className="activity-sub">Sri Foods - {districtName || territoryList[0]?.name || stateName}</div>
              </div>
              <span className="activity-time">10:24 AM</span>
            </div>

            <div className="activity-item">
              <div className="activity-icon-node" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle size={14} />
              </div>
              <div className="activity-text-content">
                <div className="activity-title">KYC approved</div>
                <div className="activity-sub">ABC Traders - {territoryList[1]?.name || stateName}</div>
              </div>
              <span className="activity-time">09:18 AM</span>
            </div>

            <div className="activity-item">
              <div className="activity-icon-node" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Handshake size={14} />
              </div>
              <div className="activity-text-content">
                <div className="activity-title">New tie-up created</div>
                <div className="activity-sub">Fresh Mart - {territoryList[2]?.name || stateName}</div>
              </div>
              <span className="activity-time">12:30 PM</span>
            </div>

            <div className="activity-item">
              <div className="activity-icon-node" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={14} />
              </div>
              <div className="activity-text-content">
                <div className="activity-title">Issue escalated</div>
                <div className="activity-sub">Payment delay - {territoryList[3]?.name || stateName}</div>
              </div>
              <span className="activity-time">02:00 PM</span>
            </div>

            <div className="activity-item">
              <div className="activity-icon-node" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                <FileText size={14} />
              </div>
              <div className="activity-text-content">
                <div className="activity-title">Manager report submitted</div>
                <div className="activity-sub">Division A - Krishnagiri</div>
              </div>
              <span className="activity-time">04:30 PM</span>
            </div>
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
                {topManagers.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: '#94a3b8', fontWeight: 600 }}>{m.id}</td>
                    <td>
                      <span className="manager-avatar-mini" style={{ background: m.avatarBg, color: 'white' }}>
                        {m.name.slice(0, 1)}
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
                ))}
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
              onClick={() => onNavigate && onNavigate('issues')}
            >
              <span>Manage & Resolve Issues</span>
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
    </div>
  );
};

export default Dashboard;
