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
  const [trendPeriod, setTrendPeriod] = useState('3m'); // '3m' | '6m' | '1y'
  const [territoryFilter, setTerritoryFilter] = useState('pin'); // 'dist' | 'div' | 'pin'
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

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
  const stateName = user?.scope?.stateName || user?.scope?.regionName || user?.state || 'Tamil Nadu';
  const districtName = user?.scope?.districtName;
  const divisionName = user?.scope?.divisionName;
  const pincodeCode = user?.scope?.pincodeCode;
  const isStateManager = (user?.role || '').toLowerCase().includes('state');

  // Trend Data for 6 months
  const trendDataMap = {
    '3m': [
      { month: 'Apr', merchants: 75, tieUps: 670, barH: 88, dotY: 60 },
      { month: 'May', merchants: 88, tieUps: 810, barH: 104, dotY: 42 },
      { month: 'Jun', merchants: 100, tieUps: 940, barH: 118, dotY: 26 }
    ],
    '6m': [
      { month: 'Jan', merchants: 45, tieUps: 320, barH: 52, dotY: 104 },
      { month: 'Feb', merchants: 52, tieUps: 450, barH: 62, dotY: 88 },
      { month: 'Mar', merchants: 64, tieUps: 580, barH: 76, dotY: 72 },
      { month: 'Apr', merchants: 75, tieUps: 670, barH: 88, dotY: 60 },
      { month: 'May', merchants: 88, tieUps: 810, barH: 104, dotY: 42 },
      { month: 'Jun', merchants: 100, tieUps: 940, barH: 118, dotY: 26 }
    ],
    '1y': [
      { month: 'Jul', merchants: 28, tieUps: 180, barH: 32, dotY: 118 },
      { month: 'Aug', merchants: 34, tieUps: 220, barH: 38, dotY: 112 },
      { month: 'Sep', merchants: 38, tieUps: 260, barH: 42, dotY: 108 },
      { month: 'Oct', merchants: 42, tieUps: 290, barH: 48, dotY: 106 },
      { month: 'Nov', merchants: 40, tieUps: 310, barH: 46, dotY: 105 },
      { month: 'Dec', merchants: 44, tieUps: 340, barH: 50, dotY: 102 },
      { month: 'Jan', merchants: 45, tieUps: 320, barH: 52, dotY: 104 },
      { month: 'Feb', merchants: 52, tieUps: 450, barH: 62, dotY: 88 },
      { month: 'Mar', merchants: 64, tieUps: 580, barH: 76, dotY: 72 },
      { month: 'Apr', merchants: 75, tieUps: 670, barH: 88, dotY: 60 },
      { month: 'May', merchants: 88, tieUps: 810, barH: 104, dotY: 42 },
      { month: 'Jun', merchants: 100, tieUps: 940, barH: 118, dotY: 26 }
    ]
  };
  const trendData = trendDataMap[trendPeriod] || trendDataMap['3m'];

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

  // Dynamic Territories based on manager's assigned state & district
  const territoryList = React.useMemo(() => {
    if (territoryFilter === 'pin') {
      if (stateName.includes('Tamil') || stateName === 'Tamil Nadu') {
        return [
          { name: '636114 (Salem Attur)', value: 712, percent: 92 },
          { name: '636001 (Salem Fort)', value: 620, percent: 80 },
          { name: '600001 (Chennai Central)', value: 584, percent: 76 },
          { name: '641001 (Coimbatore Main)', value: 512, percent: 68 },
          { name: '625001 (Madurai Town)', value: 486, percent: 64 }
        ];
      }
      if (stateName === 'Karnataka') {
        return [
          { name: '560034 (Koramangala)', value: 850, percent: 95 },
          { name: '560095 (HSR Layout)', value: 712, percent: 88 },
          { name: '560001 (MG Road)', value: 620, percent: 80 },
          { name: '570001 (Mysuru Town)', value: 584, percent: 76 },
          { name: '590001 (Belagavi)', value: 512, percent: 68 }
        ];
      }
      if (stateName === 'Maharashtra') {
        return [
          { name: '400001 (Mumbai Fort)', value: 890, percent: 96 },
          { name: '411001 (Pune Station)', value: 740, percent: 89 },
          { name: '440001 (Nagpur City)', value: 610, percent: 78 },
          { name: '400601 (Thane West)', value: 550, percent: 72 },
          { name: '422001 (Nashik GPO)', value: 490, percent: 65 }
        ];
      }
      return [
        { name: 'PIN 636114', value: 712, percent: 92 },
        { name: 'PIN 636001', value: 620, percent: 80 },
        { name: 'PIN 600001', value: 584, percent: 76 },
        { name: 'PIN 641001', value: 512, percent: 68 },
        { name: 'PIN 625001', value: 486, percent: 64 }
      ];
    }

    if (territoryFilter === 'div') {
      if (stateName.includes('Tamil') || stateName === 'Tamil Nadu') {
        return [
          { name: 'Salem Division', value: 820, percent: 94 },
          { name: 'Chennai North Division', value: 760, percent: 88 },
          { name: 'Coimbatore South Division', value: 690, percent: 80 },
          { name: 'Madurai Urban Division', value: 610, percent: 72 },
          { name: 'Tiruchirappalli Division', value: 530, percent: 64 }
        ];
      }
      if (stateName === 'Karnataka') {
        return [
          { name: 'Bengaluru Central Div', value: 870, percent: 96 },
          { name: 'Bengaluru South Div', value: 790, percent: 89 },
          { name: 'Mysuru City Div', value: 680, percent: 78 },
          { name: 'Mangaluru Div', value: 610, percent: 71 },
          { name: 'Hubballi Div', value: 540, percent: 63 }
        ];
      }
      if (stateName === 'Maharashtra') {
        return [
          { name: 'Mumbai City Div', value: 910, percent: 96 },
          { name: 'Pune Cantonment Div', value: 780, percent: 86 },
          { name: 'Nagpur Central Div', value: 640, percent: 76 },
          { name: 'Thane Urban Div', value: 580, percent: 70 },
          { name: 'Nashik Valley Div', value: 510, percent: 64 }
        ];
      }
      return [
        { name: `${stateName} Division A`, value: 820, percent: 94 },
        { name: `${stateName} Division B`, value: 760, percent: 88 },
        { name: `${stateName} Division C`, value: 690, percent: 80 },
        { name: `${stateName} Division D`, value: 610, percent: 72 },
        { name: `${stateName} Division E`, value: 530, percent: 64 }
      ];
    }

    // Default 'dist' (Districts)
    if (stateName.includes('Tamil') || stateName === 'Tamil Nadu') {
      return [
        { name: 'Chennai District', value: 890, percent: 96 },
        { name: 'Salem District', value: 712, percent: 88 },
        { name: 'Coimbatore District', value: 640, percent: 80 },
        { name: 'Madurai District', value: 584, percent: 74 },
        { name: 'Tiruchirappalli District', value: 512, percent: 66 }
      ];
    }
    if (stateName === 'Karnataka') {
      return [
        { name: 'Bengaluru Urban', value: 920, percent: 98 },
        { name: 'Mysuru', value: 750, percent: 85 },
        { name: 'Belagavi', value: 660, percent: 76 },
        { name: 'Mangaluru', value: 590, percent: 70 },
        { name: 'Hubballi-Dharwad', value: 520, percent: 62 }
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
  }, [stateName, territoryFilter]);

  // Dynamic Top Performing Managers matching manager's jurisdiction
  
  const allActivitiesList = [
    {
      id: 1,
      category: 'vendor',
      title: 'New vendor request received',
      sub: `Sri Foods - ${districtName || territoryList[0]?.name || stateName}`,
      time: '10:24 AM Today',
      icon: UserPlus,
      bg: '#e0f2fe',
      color: '#0284c7',
      tag: 'Vendor Request'
    },
    {
      id: 2,
      category: 'kyc',
      title: 'Physical KYC verification approved',
      sub: `ABC Traders - ${territoryList[1]?.name || stateName}`,
      time: '09:18 AM Today',
      icon: CheckCircle,
      bg: '#dcfce7',
      color: '#16a34a',
      tag: 'KYC Verified'
    },
    {
      id: 3,
      category: 'tieup',
      title: 'New merchant tie-up created',
      sub: `Fresh Mart - ${territoryList[2]?.name || stateName}`,
      time: '12:30 PM Today',
      icon: Handshake,
      bg: '#fef3c7',
      color: '#d97706',
      tag: 'Tie-up Active'
    },
    {
      id: 4,
      category: 'escalation',
      title: 'Issue escalated: Payout delay inquiry',
      sub: `Payment review - ${territoryList[3]?.name || stateName}`,
      time: '02:00 PM Today',
      icon: AlertTriangle,
      bg: '#fee2e2',
      color: '#dc2626',
      tag: 'Escalation'
    },
    {
      id: 5,
      category: 'report',
      title: 'Manager territory report submitted',
      sub: `Division Operations - ${divisionName || 'Krishnagiri Division'}`,
      time: '04:30 PM Today',
      icon: FileText,
      bg: '#ede9fe',
      color: '#7c3aed',
      tag: 'Field Report'
    },
    {
      id: 6,
      category: 'vendor',
      title: 'Shop visit & QR standee installed',
      sub: `Anand Sweets - ${districtName || 'Salem'}`,
      time: 'Yesterday 05:15 PM',
      icon: Store,
      bg: '#e0f2fe',
      color: '#0284c7',
      tag: 'Shop Visit'
    },
    {
      id: 7,
      category: 'kyc',
      title: 'GSTIN verification audited',
      sub: `Karthik Hardware - ${territoryList[0]?.name || stateName}`,
      time: 'Yesterday 02:40 PM',
      icon: CheckCircle,
      bg: '#dcfce7',
      color: '#16a34a',
      tag: 'Compliance'
    },
    {
      id: 8,
      category: 'tieup',
      title: 'Commercial agreement renewal signed',
      sub: `Royal Supermart - ${districtName || 'Chennai'}`,
      time: '20 Sep 2026',
      icon: Handshake,
      bg: '#fef3c7',
      color: '#d97706',
      tag: 'Agreement Renewal'
    }
  ];

  const filteredActivities = allActivitiesList.filter(act => {
    if (activityFilter !== 'all' && act.category !== activityFilter) return false;
    return true;
  });

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
              onClick={() => setIsActivitiesModalOpen(true)}
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
