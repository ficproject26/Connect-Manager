import React, { useState, useEffect, useCallback } from 'react';
import { shopVisitService, reportService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Download,
  History,
  FileSpreadsheet,
  Printer,
  Store,
  Search,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  User,
  Users,
  MapPin,
  Calendar,
  Clock,
  Award,
  Layers,
  ShieldCheck,
  Building2,
  FolderTree,
  Navigation,
  X,
  Mic,
  FileText,
  Tag,
  Info,
  BadgeCheck,
  FileCheck,
  Phone,
  Mail,
  CheckSquare,
  Eye,
  Filter,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import ShopVisitModal from '../components/ShopVisitModal';
import GenerateReportModal from '../components/GenerateReportModal';

const MAIN_CATEGORIES = [
  'Services',
  'Products',
  'Daily Needs',
  'Food',
  'Stay',
  'Travel',
  'Jobs'
];

const getCategoryBadgeStyle = (cat) => {
  const c = String(cat || '').toLowerCase().trim();
  if (c === 'services') return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
  if (c === 'products') return { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' };
  if (c === 'daily needs' || c === 'dailyneeds') return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
  if (c === 'food') return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
  if (c === 'stay') return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
  if (c === 'travel') return { bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' };
  if (c === 'jobs') return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
};

const formatRoleLabel = (role) => {
  if (!role) return 'Pincode Manager';
  const clean = String(role).toLowerCase().replace(/_/g, ' ');
  if (clean.includes('state')) return 'State Manager';
  if (clean.includes('district')) return 'District Manager';
  if (clean.includes('division') || clean.includes('divisional')) return 'Division Manager';
  if (clean.includes('pincode')) return 'Pincode Manager';
  return String(role).replace(/_/g, ' ');
};

const getLevelBadgeStyle = (role) => {
  if (!role) return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  const clean = String(role).toLowerCase();
  if (clean.includes('state')) return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
  if (clean.includes('district')) return { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' };
  if (clean.includes('division')) return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
  return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
};

const Reports = ({ onNavigate }) => {
  const { user } = useAuth();

  const userRole = (user?.role || '').toLowerCase();
  const isStateManager = userRole.includes('state') || userRole === 'state_manager';
  const isDistrictManager = userRole.includes('district') || userRole === 'district_manager';
  const isDivisionManager = userRole.includes('division') || userRole.includes('divisional') || userRole === 'division_manager';
  const isPincodeManager = userRole.includes('pincode') || userRole === 'pincode_manager';

  // Active Main Tab: 'visits' (Field Shop Visits) | 'team_reports' (Team Reports)
  const [activeTab, setActiveTab] = useState('visits');

  // --- SHOP VISITS STATE ---
  const [viewScope, setViewScope] = useState(isPincodeManager ? 'self' : 'all');
  const [visits, setVisits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [searchVisit, setSearchVisit] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  // --- SUBMITTED TEAM REPORTS STATE ---
  const [submittedReports, setSubmittedReports] = useState([]);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [selectedSubmittedReport, setSelectedSubmittedReport] = useState(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Hierarchical Filter State for Team Reports
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterPincode, setFilterPincode] = useState('All');
  const [filterRole, setFilterRole] = useState('All');
  const [searchReport, setSearchReport] = useState('');
  const [hierarchyOptions, setHierarchyOptions] = useState({ districts: [], divisions: [], pincodes: [] });

  // Load Shop Visits
  const loadVisits = useCallback(async (page = 1) => {
    setLoadingVisits(true);
    try {
      const params = { page, limit: 15 };
      if (viewScope !== 'all') params.scope = viewScope;
      if (searchVisit && searchVisit.trim()) params.search = searchVisit.trim();
      if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
      if (categoryFilter && categoryFilter !== 'All') params.category = categoryFilter;

      const res = await shopVisitService.getShopVisits(params);
      if (res && res.success) {
        const visitList = Array.isArray(res.data) ? res.data : [];
        setVisits(visitList);
        setPagination(res.pagination || { page: 1, limit: 15, total: visitList.length, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load shop visits:', err);
    } finally {
      setLoadingVisits(false);
    }
  }, [viewScope, searchVisit, statusFilter, categoryFilter]);

  // Load Submitted Reports
  const loadSubmittedReports = useCallback(async () => {
    setLoadingSubmitted(true);
    try {
      const params = {};
      if (filterDistrict !== 'All') params.district = filterDistrict;
      if (filterDivision !== 'All') params.division = filterDivision;
      if (filterPincode !== 'All') params.pincode = filterPincode;
      if (filterRole !== 'All') params.managerRole = filterRole;
      if (searchReport && searchReport.trim()) params.search = searchReport.trim();

      const res = await reportService.getSubmittedReports(params);
      if (res && res.success) {
        setSubmittedReports(res.data || []);
        if (res.hierarchy) {
          setHierarchyOptions({
            districts: res.hierarchy.districts || [],
            divisions: res.hierarchy.divisions || [],
            pincodes: res.hierarchy.pincodes || []
          });
        }
      }
    } catch (err) {
      console.error('Failed to load submitted reports:', err);
    } finally {
      setLoadingSubmitted(false);
    }
  }, [filterDistrict, filterDivision, filterPincode, filterRole, searchReport]);

  useEffect(() => {
    loadVisits(1);
  }, [loadVisits]);

  useEffect(() => {
    loadSubmittedReports();
  }, [loadSubmittedReports]);

  // CSV Export for Visits
  const exportShopVisitsCSV = () => {
    if (!visits.length) return;
    const headers = ['Date & Time', 'Shop Name', 'Category', 'Manager Name', 'Manager Level', 'Scope Territory', 'Voice Note URL', 'Interest Status', 'Not Interested Reason'];
    const rows = visits.map(v => [
      v && v.createdAt ? `"${new Date(v.createdAt).toLocaleString()}"` : '""',
      `"${(v && v.shopName) || ''}"`,
      `"${(v && v.category) || 'Products'}"`,
      `"${(v && v.managerName) || ''}"`,
      `"${formatRoleLabel(v && v.managerRole)}"`,
      `"${(v && (v.pincodeCode || v.division || v.district || v.state)) || 'Assigned Territory'}"`,
      `"${(v && v.voiceNote) || ''}"`,
      (v && v.interestedStatus) || '',
      `"${((v && v.notInterestedReason) || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `shop_visits_${viewScope}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print / PDF Export for Complete Submitted Report
  const handlePrintPDF = () => {
    window.print();
  };

  const totalVisitCount = pagination && pagination.total !== undefined ? pagination.total : visits.length;
  const interestedCount = visits.filter(v => v && v.interestedStatus === 'YES').length;
  const notInterestedCount = visits.filter(v => v && v.interestedStatus === 'NO').length;

  return (
    <div style={{ width: '100%' }}>
      {/* 1. Header with Title & Action Buttons */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Shop Visit Reports
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              background: '#fef3c7',
              color: '#d97706',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid #fde68a'
            }}>
              {activeTab === 'visits' ? `${totalVisitCount} Total Visits` : `${submittedReports.length} Submitted Reports`}
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
            {activeTab === 'visits'
              ? (isPincodeManager
                ? `Showing field merchant shop visits recorded in PIN: ${user?.pincode || '635112'}`
                : 'Showing all state field shop visits recorded across all managers and subordinate tiers.')
              : 'Showing submitted manager performance audit reports organized by supervisory hierarchy.'}
          </p>
        </div>

        {/* Top Header Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>


          {/* Generate Report Button */}
          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              padding: '9px 18px',
              borderRadius: 9,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            title="Generate and submit field performance report"
          >
            <FileSpreadsheet size={16} style={{ color: '#0284c7' }} />
            <span>Generate Report</span>
          </button>

          {/* Start Shop Visit Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 9,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.28)',
              whiteSpace: 'nowrap'
            }}
          >
            <PlusCircle size={16} /> Start Shop Visit
          </button>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* VIEW 1: FIELD SHOP VISITS (Original Flow Preserved)                       */}
      {/* ========================================================================= */}
      {activeTab === 'visits' && (
        <>
          {/* Scope Filter Switcher Tabs (RBAC) with Team Reports & Report History */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 20,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            padding: '4px 6px',
            borderRadius: 12,
            width: '100%',
            boxSizing: 'border-box',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              flex: '1 1 auto'
            }}>
            {!isPincodeManager && (
              <button
                type="button"
                onClick={() => setViewScope('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: viewScope === 'all' ? '#ffffff' : 'transparent',
                  color: viewScope === 'all' ? '#0f172a' : '#64748b',
                  boxShadow: viewScope === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Layers size={14} style={{ color: viewScope === 'all' ? '#f59e0b' : '#94a3b8' }} />
                <span>All Reports</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewScope('self')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.81rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                background: viewScope === 'self' ? '#ffffff' : 'transparent',
                color: viewScope === 'self' ? '#0f172a' : '#64748b',
                boxShadow: viewScope === 'self' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <User size={14} style={{ color: viewScope === 'self' ? '#0284c7' : '#94a3b8' }} />
              <span>My Reports</span>
            </button>

            {isStateManager && (
              <button
                type="button"
                onClick={() => setViewScope('state_managers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: viewScope === 'state_managers' ? '#0284c7' : 'transparent',
                  color: viewScope === 'state_managers' ? '#ffffff' : '#64748b'
                }}
              >
                <ShieldCheck size={14} style={{ color: viewScope === 'state_managers' ? '#ffffff' : '#0284c7' }} />
                <span>State Managers</span>
              </button>
            )}

            {(isStateManager || isDistrictManager) && (
              <button
                type="button"
                onClick={() => setViewScope('district_managers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: viewScope === 'district_managers' ? '#4f46e5' : 'transparent',
                  color: viewScope === 'district_managers' ? '#ffffff' : '#64748b'
                }}
              >
                <Building2 size={14} style={{ color: viewScope === 'district_managers' ? '#ffffff' : '#4f46e5' }} />
                <span>District Managers</span>
              </button>
            )}

            {(isStateManager || isDistrictManager || isDivisionManager) && (
              <button
                type="button"
                onClick={() => setViewScope('division_managers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: viewScope === 'division_managers' ? '#d97706' : 'transparent',
                  color: viewScope === 'division_managers' ? '#ffffff' : '#64748b'
                }}
              >
                <FolderTree size={14} style={{ color: viewScope === 'division_managers' ? '#ffffff' : '#d97706' }} />
                <span>Division Managers</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => { setActiveTab('visits'); setViewScope('pincode_managers'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.81rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                background: activeTab === 'visits' && viewScope === 'pincode_managers' ? '#15803d' : 'transparent',
                color: activeTab === 'visits' && viewScope === 'pincode_managers' ? '#ffffff' : '#64748b'
              }}
            >
              <Navigation size={14} style={{ color: activeTab === 'visits' && viewScope === 'pincode_managers' ? '#ffffff' : '#15803d' }} />
              <span>Pincode Managers</span>
            </button>


          </div>

          {/* Right side corner: Report History pill */}
          <div style={{ flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setActiveTab('team_reports')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: activeTab === 'team_reports' ? '#0284c7' : '#cbd5e1',
                fontSize: '0.81rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'team_reports' ? '#0f172a' : '#ffffff',
                color: activeTab === 'team_reports' ? '#ffffff' : '#0f172a',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s'
              }}
            >
              <History size={14} style={{ color: activeTab === 'team_reports' ? '#38bdf8' : '#0284c7' }} />
              <span>Report History</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                background: activeTab === 'team_reports' ? '#0284c7' : '#e0f2fe',
                color: activeTab === 'team_reports' ? '#ffffff' : '#0369a1',
                padding: '1px 6px',
                borderRadius: 10
              }}>
                {submittedReports.length}
              </span>
            </button>
          </div>
        </div>

          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 20
          }}>
            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #3b82f6', background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {viewScope === 'state_managers' ? 'State Manager Visits' : viewScope === 'district_managers' ? 'District Manager Visits' : viewScope === 'division_managers' ? 'Division Manager Visits' : viewScope === 'pincode_managers' ? 'Pincode Manager Visits' : viewScope === 'self' ? 'My Direct Visits' : 'Total Visits Recorded'}
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{totalVisitCount}</div>
            </div>
            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #10b981', background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interested</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>{interestedCount}</div>
            </div>
            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #ef4444', background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Not Interested</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{notInterestedCount}</div>
            </div>
          </div>

          {/* Filter Panel & Right-Aligned Export to CSV */}
          <div className="card" style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            marginBottom: 20,
            padding: '14px 18px'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: '1 1 220px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search shop, category, manager..."
                  className="form-input"
                  value={searchVisit}
                  onChange={(e) => setSearchVisit(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    fontSize: '0.84rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ width: 175 }}>
                <select
                  className="form-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.84rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <option value="All">All 7 Categories</option>
                  {MAIN_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: 165 }}>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.84rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <option value="All">All Interest Statuses</option>
                  <option value="YES">Interested</option>
                  <option value="NO">Not Interested</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={exportShopVisitsCSV}
                disabled={!visits.length}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid var(--border)',
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: visits.length ? 'pointer' : 'not-allowed',
                  opacity: visits.length ? 1 : 0.6,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Download size={15} /> Export to CSV
              </button>
            </div>
          </div>

          {/* Visits Table */}
          <div className="card" style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Date
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Category &amp; Shop Name
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Manager &amp; Level
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Interest Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingVisits ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <RotateCcw className="animate-spin" size={24} style={{ color: '#f59e0b' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>Loading shop visits...</span>
                        </div>
                      </td>
                    </tr>
                  ) : visits.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                        <Store size={36} style={{ margin: '0 auto 10px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>No Shop Visits Found</div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 14px' }}>
                          No visit records submitted under this view scope.
                        </p>
                        <button
                          type="button"
                          onClick={() => setModalOpen(true)}
                          className="btn btn-primary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#f59e0b',
                            color: '#0f172a',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          <PlusCircle size={15} /> Record New Shop Visit
                        </button>
                      </td>
                    </tr>
                  ) : (
                    visits.map((v, idx) => {
                      const isYes = v.interestedStatus === 'YES';
                      const roleLabel = formatRoleLabel(v.managerRole);
                      const badgeStyle = getLevelBadgeStyle(v.managerRole);
                      const catStyle = getCategoryBadgeStyle(v.category || 'Products');

                      return (
                        <tr
                          key={v._id || v.id || idx}
                          onClick={() => setSelectedVisit(v)}
                          title="Click row to view complete shop visit details, KYC, photo, and voice note"
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* Date */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Calendar size={14} style={{ color: '#64748b' }} />
                              <span>{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}</span>
                            </div>
                          </td>

                          {/* Category & Shop Name */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: catStyle.bg,
                                  color: catStyle.color,
                                  border: `1px solid ${catStyle.border}`
                                }}>
                                  <Tag size={10} />
                                  {v.category || 'Products'}
                                </span>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                                  {v.shopName || 'Unnamed Shop'}
                                </span>
                              </div>

                              {v.vendorId ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#059669', fontWeight: 700, background: '#d1fae5', padding: '1px 6px', borderRadius: 4, width: 'fit-content' }}>
                                  <CheckCircle2 size={11} /> Vendor Account Created
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Field Visit Record</div>
                              )}
                            </div>
                          </td>

                          {/* Manager & Level */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <User size={14} style={{ color: '#0284c7', flexShrink: 0 }} />
                                <span>{v.managerName || 'Manager'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: badgeStyle.bg,
                                  color: badgeStyle.color,
                                  border: `1px solid ${badgeStyle.border}`
                                }}>
                                  <Award size={11} />
                                  {roleLabel}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <MapPin size={11} style={{ color: '#94a3b8' }} />
                                  {v.pincodeCode ? `PIN: ${v.pincodeCode}` : (v.division || v.district || v.state || 'Assigned Territory')}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Interest Status */}
                          <td style={{ padding: '16px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                            {isYes ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#d1fae5', color: '#047857', fontSize: '0.78rem', fontWeight: 800, border: '1px solid #a7f3d0' }}>
                                <CheckCircle2 size={13} /> Interested
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#fee2e2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 800, border: '1px solid #fecaca' }}>
                                  <XCircle size={13} /> Not Interested
                                </span>
                                {v.notInterestedReason && (
                                  <span style={{ fontSize: '0.74rem', color: '#64748b', maxWidth: 170, textAlign: 'center' }}>
                                    {v.notInterestedReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: HIERARCHICAL TEAM REPORTS (Reports -> Team Reports)               */}
      {/* ========================================================================= */}
      {activeTab === 'team_reports' && (
        <div>
                    {/* Navigation Pill Bar on History view (Hierarchical RBAC) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 20,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            padding: '4px 6px',
            borderRadius: 12,
            width: '100%',
            boxSizing: 'border-box',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              flex: '1 1 auto'
            }}>
              {!isPincodeManager && (
                <button
                  type="button"
                  onClick={() => { setFilterRole('All'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.81rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: filterRole === 'All' ? '#ffffff' : 'transparent',
                    color: filterRole === 'All' ? '#0f172a' : '#64748b',
                    boxShadow: filterRole === 'All' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Layers size={14} style={{ color: filterRole === 'All' ? '#f59e0b' : '#94a3b8' }} />
                  <span>All Reports</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => { setActiveTab('visits'); setViewScope('self'); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: 'transparent',
                  color: '#64748b'
                }}
              >
                <User size={14} style={{ color: '#0284c7' }} />
                <span>My Reports</span>
              </button>

              {isStateManager && (
                <button
                  type="button"
                  onClick={() => { setFilterRole('state'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.81rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: filterRole === 'state' ? '#0284c7' : 'transparent',
                    color: filterRole === 'state' ? '#ffffff' : '#64748b'
                  }}
                >
                  <ShieldCheck size={14} style={{ color: filterRole === 'state' ? '#ffffff' : '#0284c7' }} />
                  <span>State Managers</span>
                </button>
              )}

              {(isStateManager || isDistrictManager) && (
                <button
                  type="button"
                  onClick={() => { setFilterRole('district'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.81rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: filterRole === 'district' ? '#4f46e5' : 'transparent',
                    color: filterRole === 'district' ? '#ffffff' : '#64748b'
                  }}
                >
                  <Building2 size={14} style={{ color: filterRole === 'district' ? '#ffffff' : '#4f46e5' }} />
                  <span>District Managers</span>
                </button>
              )}

              {(isStateManager || isDistrictManager || isDivisionManager) && (
                <button
                  type="button"
                  onClick={() => { setFilterRole('division'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.81rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: filterRole === 'division' ? '#d97706' : 'transparent',
                    color: filterRole === 'division' ? '#ffffff' : '#64748b'
                  }}
                >
                  <FolderTree size={14} style={{ color: filterRole === 'division' ? '#ffffff' : '#d97706' }} />
                  <span>Division Managers</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => { setFilterRole('pincode'); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: filterRole === 'pincode' ? '#15803d' : 'transparent',
                  color: filterRole === 'pincode' ? '#ffffff' : '#64748b'
                }}
              >
                <Navigation size={14} style={{ color: filterRole === 'pincode' ? '#ffffff' : '#15803d' }} />
                <span>Pincode Managers</span>
              </button>
            </div>

            {/* Right side corner: Active Report History badge */}
            <div style={{ flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setActiveTab('team_reports')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid #0284c7',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: '#0f172a',
                  color: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <History size={14} style={{ color: '#38bdf8' }} />
                <span>Report History</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: 10
                }}>
                  {submittedReports.length}
                </span>
              </button>
            </div>
          </div>

          {/* Hierarchy Filter Panel */}
          <div className="card" style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '16px 20px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} style={{ color: '#0284c7' }} />
                <span>Supervisory Hierarchy &amp; Geographic Filters</span>
              </div>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Showing submitted reports under your jurisdiction ({user?.state || 'State'})
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search manager or PIN..."
                  value={searchReport}
                  onChange={(e) => setSearchReport(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 30px',
                    fontSize: '0.82rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* District Filter (if State Manager or District Manager) */}
              {(isStateManager || isDistrictManager) && (
                <div>
                  <select
                    value={filterDistrict}
                    onChange={(e) => setFilterDistrict(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', borderRadius: 8, border: '1px solid var(--border)', background: '#f8fafc' }}
                  >
                    <option value="All">All Districts</option>
                    {hierarchyOptions.districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Division Filter */}
              {(isStateManager || isDistrictManager || isDivisionManager) && (
                <div>
                  <select
                    value={filterDivision}
                    onChange={(e) => setFilterDivision(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', borderRadius: 8, border: '1px solid var(--border)', background: '#f8fafc' }}
                  >
                    <option value="All">All Divisions</option>
                    {hierarchyOptions.divisions.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pincode Filter */}
              <div>
                <select
                  value={filterPincode}
                  onChange={(e) => setFilterPincode(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', borderRadius: 8, border: '1px solid var(--border)', background: '#f8fafc' }}
                >
                  <option value="All">All Pincodes</option>
                  {hierarchyOptions.pincodes.map(p => (
                    <option key={p} value={p}>PIN: {p}</option>
                  ))}
                </select>
              </div>

              {/* Manager Role Filter */}
              <div>
                {!isPincodeManager && (
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', borderRadius: 8, border: '1px solid var(--border)', background: '#f8fafc' }}
                  >
                    <option value="All">All Manager Tiers</option>
                    {isStateManager && (
                      <option value="state">State Managers</option>
                    )}
                    {(isStateManager || isDistrictManager) && (
                      <option value="district">District Managers</option>
                    )}
                    {(isStateManager || isDistrictManager || isDivisionManager) && (
                      <option value="division">Division Managers</option>
                    )}
                    <option value="pincode">Pincode Managers</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Submitted Reports Table */}
          <div className="card" style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Date
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Manager Name &amp; Level
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Jurisdiction
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 800, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSubmitted ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                        <RotateCcw className="animate-spin" size={24} style={{ color: '#0284c7', margin: '0 auto 8px' }} />
                        <div>Loading submitted team reports...</div>
                      </td>
                    </tr>
                  ) : submittedReports.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                        <FileSpreadsheet size={36} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>No Submitted Reports Found</div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 14px' }}>
                          No period audit reports submitted matching this jurisdiction filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsGenerateModalOpen(true)}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          Generate New Report
                        </button>
                      </td>
                    </tr>
                  ) : (
                    submittedReports.map((rpt, idx) => {
                      const badgeStyle = getLevelBadgeStyle(rpt.managerRole);
                      return (
                        <tr
                          key={rpt._id || rpt.id || idx}
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* 1. Date */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                              <Calendar size={14} style={{ color: '#0284c7' }} />
                              <span>{rpt.dateRange || rpt.periodLabel || (rpt.submittedAt ? new Date(rpt.submittedAt).toLocaleDateString() : 'Today')}</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3, fontFamily: 'monospace' }}>
                              {rpt.reportNumber}
                            </div>
                          </td>

                          {/* 2. Manager Name & Level */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: '#f1f5f9',
                                color: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.84rem',
                                border: '1px solid #cbd5e1'
                              }}>
                                {(rpt.managerName || 'M').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                  {rpt.managerName}
                                </div>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: badgeStyle.bg,
                                  color: badgeStyle.color,
                                  marginTop: 2
                                }}>
                                  {formatRoleLabel(rpt.managerRole)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Jurisdiction */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 700 }}>
                              {rpt.district || 'District'} {rpt.division ? `• ${rpt.division}` : ''}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                              {rpt.pincode ? `PIN: ${rpt.pincode}` : (rpt.state || 'Tamil Nadu')}
                            </div>
                          </td>

                          {/* 4. Status */}
                          <td style={{ padding: '16px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: 20,
                              background: '#d1fae5',
                              color: '#047857',
                              border: '1px solid #a7f3d0'
                            }}>
                              <CheckCircle2 size={12} /> {rpt.status || 'Submitted'}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: '16px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedSubmittedReport(rpt)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '6px 12px',
                                borderRadius: 7,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0284c7',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#0284c7';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#0284c7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.color = '#0284c7';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                              }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLETE SUBMITTED REPORT AUDIT MODAL (With Download PDF / Print)         */}
      {/* ========================================================================= */}
      {selectedSubmittedReport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)'
        }}>
          <div onClick={() => setSelectedSubmittedReport(null)} style={{ position: 'absolute', inset: 0 }} />

          <div
            id="printable-report-card"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '860px',
              maxHeight: 'min(92vh, 880px)',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              zIndex: 1
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)'
                }}>
                  <FileText size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Official Field Performance Report
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                    Report No: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedSubmittedReport.reportNumber}</span>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Download PDF Button */}
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  title="Export and print official report PDF"
                >
                  <Printer size={15} style={{ color: '#0284c7' }} />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSubmittedReport(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* 1. Report Header Banner */}
              <div style={{
                padding: '16px 20px',
                background: '#f8fafc',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: getLevelBadgeStyle(selectedSubmittedReport.managerRole).bg,
                      color: getLevelBadgeStyle(selectedSubmittedReport.managerRole).color,
                      padding: '2px 8px',
                      borderRadius: 6
                    }}>
                      {formatRoleLabel(selectedSubmittedReport.managerRole)}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      {selectedSubmittedReport.managerName}
                    </h4>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                    Jurisdiction: {selectedSubmittedReport.district || 'District'} {selectedSubmittedReport.division ? `• ${selectedSubmittedReport.division}` : ''} {selectedSubmittedReport.pincode ? `• PIN: ${selectedSubmittedReport.pincode}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Submitted: <strong>{selectedSubmittedReport.submittedAt ? new Date(selectedSubmittedReport.submittedAt).toLocaleString() : '—'}</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: '#d1fae5', color: '#047857' }}>
                      Status: {selectedSubmittedReport.status || 'Submitted'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Summary KPI Grid */}
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
                  Report Performance Summary ({selectedSubmittedReport.dateRange || selectedSubmittedReport.periodLabel})
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10
                }}>
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Total Visits</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{selectedSubmittedReport.summary?.totalVisits ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Interested</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{selectedSubmittedReport.summary?.interested ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Not Interested</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{selectedSubmittedReport.summary?.notInterested ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#e0f2fe', borderRadius: 10, border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>New Tie-ups</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{selectedSubmittedReport.summary?.newTieups ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>Tasks Done</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{selectedSubmittedReport.summary?.tasksCompleted ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>Tasks Pending</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{selectedSubmittedReport.summary?.tasksPending ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* 3. Shop Visit Details List with Photos, Audio Note & KYC */}
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={16} style={{ color: '#f59e0b' }} />
                  <span>Shop Visit Records ({selectedSubmittedReport.shopVisits?.length || 0})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(selectedSubmittedReport.shopVisits || []).map((v, vIdx) => (
                    <div
                      key={v._id || v.id || vIdx}
                      style={{
                        padding: '14px 16px',
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {v.shopPhoto ? (
                            <img
                              src={v.shopPhoto}
                              alt={v.shopName}
                              style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                            />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              <ImageIcon size={24} />
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>
                                {v.category || 'Products'}
                              </span>
                              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{v.shopName}</strong>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                              PIN: {v.pincodeCode || v.pincode || '635112'} • Visited: {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {v.interestedStatus === 'YES' ? (
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#d1fae5', color: '#047857' }}>
                              Interested
                            </span>
                          ) : (
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#fee2e2', color: '#b91c1c' }}>
                                Not Interested
                              </span>
                              {v.notInterestedReason && (
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                                  "{v.notInterestedReason}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attached Audio Voice Note Player */}
                      {v.voiceNote && (
                        <div style={{
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10
                        }}>
                          <Mic size={15} style={{ color: '#d97706' }} />
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a' }}>Voice Audit Note:</span>
                          <audio controls src={v.voiceNote} style={{ height: 28, flex: 1 }} />
                        </div>
                      )}

                      {/* Vendor Approval & KYC if Onboarded */}
                      {v.vendorId && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '6px 10px',
                          background: '#ecfdf5',
                          borderRadius: 8,
                          fontSize: '0.74rem',
                          color: '#065f46',
                          fontWeight: 700
                        }}>
                          <BadgeCheck size={14} style={{ color: '#059669' }} />
                          <span>Vendor Tie-up Created (ID: {v.vendorId})</span>
                          <span>•</span>
                          <span>Pincode Admin: {v.vendor?.approvalStatus || 'Pending Approval'}</span>
                          <span>•</span>
                          <span>KYC: {v.vendor?.kycStatus || 'Pending Verification'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Task Audit Details */}
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckSquare size={16} style={{ color: '#0284c7' }} />
                  <span>Tasks Executed in Period ({selectedSubmittedReport.tasks?.length || 0})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selectedSubmittedReport.tasks || []).map((t, tIdx) => (
                    <div
                      key={t.id || tIdx}
                      style={{
                        padding: '12px 16px',
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: t.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                            color: t.status === 'Completed' ? '#047857' : '#b45309'
                          }}>
                            {t.status}
                          </span>
                          <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>{t.title}</strong>
                        </div>
                        {t.description && (
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 3 }}>
                            {t.description}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#64748b', textAlign: 'right' }}>
                        <div>Due: {t.dueDate || '22 Sep 2026'}</div>
                        {t.completionDetails && (
                          <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>
                            {t.completionDetails}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                Forge India Connect Supervisory Audit System
              </span>

              <button
                type="button"
                onClick={() => setSelectedSubmittedReport(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE VISIT AUDIT MODAL (Row Click in Visits View)                       */}
      {/* ========================================================================= */}
      {selectedVisit && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)'
        }}>
          <div onClick={() => setSelectedVisit(null)} style={{ position: 'absolute', inset: 0 }} />

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '680px',
            maxHeight: 'min(90vh, 820px)',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            zIndex: 10
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Store size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Shop Visit Full Audit Report
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                    ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedVisit._id || selectedVisit.id}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Shop Profile & Hero Card */}
              <div style={{
                display: 'flex',
                gap: 16,
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {selectedVisit.shopPhoto ? (
                  <img
                    src={selectedVisit.shopPhoto}
                    alt={selectedVisit.shopName}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 12,
                      objectFit: 'cover',
                      border: '2px solid #ffffff',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div style={{
                    width: 90,
                    height: 90,
                    borderRadius: 12,
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    flexShrink: 0
                  }}>
                    <ImageIcon size={32} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: getCategoryBadgeStyle(selectedVisit.category || 'Products').bg,
                      color: getCategoryBadgeStyle(selectedVisit.category || 'Products').color,
                      border: `1px solid ${getCategoryBadgeStyle(selectedVisit.category || 'Products').border}`
                    }}>
                      <Tag size={11} /> {selectedVisit.category || 'Products'}
                    </span>

                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {selectedVisit.shopName || 'Shop Name'}
                    </h4>

                    {selectedVisit.interestedStatus === 'YES' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#d1fae5',
                        color: '#047857',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        border: '1px solid #a7f3d0'
                      }}>
                        <CheckCircle2 size={12} /> Interested
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#fee2e2',
                        color: '#b91c1c',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        border: '1px solid #fecaca'
                      }}>
                        <XCircle size={12} /> Not Interested
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} style={{ color: '#94a3b8' }} />
                      <span>{selectedVisit.createdAt ? new Date(selectedVisit.createdAt).toLocaleDateString() : '—'}</span>
                    </div>
                    <span>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} style={{ color: '#94a3b8' }} />
                      <span>{selectedVisit.createdAt ? new Date(selectedVisit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                  </div>

                  {selectedVisit.vendorId && (
                    <div style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '0.76rem',
                      fontWeight: 700
                    }}>
                      <CheckCircle2 size={12} /> Vendor ID: {selectedVisit.vendorId}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of Visit & Manager Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ padding: '14px 16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <User size={13} style={{ color: '#0284c7' }} /> Visiting Field Officer
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {selectedVisit.managerName || 'Field Manager'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: getLevelBadgeStyle(selectedVisit.managerRole).bg,
                      color: getLevelBadgeStyle(selectedVisit.managerRole).color,
                      border: `1px solid ${getLevelBadgeStyle(selectedVisit.managerRole).border}`
                    }}>
                      <Award size={11} /> {formatRoleLabel(selectedVisit.managerRole)}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={13} style={{ color: '#10b981' }} /> Assigned Territory
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {selectedVisit.district || selectedVisit.division || selectedVisit.state || 'Assigned Territory'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>State: {selectedVisit.state || 'Tamil Nadu'}</span>
                    {selectedVisit.pincodeCode && <span>• PIN: {selectedVisit.pincodeCode}</span>}
                  </div>
                </div>
              </div>

              {/* Pincode Admin Approval & KYC Verification Details */}
              {selectedVisit.vendorId && (
                <div style={{
                  padding: '16px',
                  background: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BadgeCheck size={17} style={{ color: '#059669' }} />
                      <span>Pincode Admin Approval &amp; KYC Verification</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      Vendor ID: {selectedVisit.vendorId}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: (selectedVisit.vendor?.approvalStatus || '').toLowerCase().includes('approved') ? '#ecfdf5' : '#fef3c7',
                      border: (selectedVisit.vendor?.approvalStatus || '').toLowerCase().includes('approved') ? '1px solid #a7f3d0' : '1px solid #fde68a'
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                        Pincode Admin Approval
                      </div>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: (selectedVisit.vendor?.approvalStatus || '').toLowerCase().includes('approved') ? '#047857' : '#b45309',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <CheckCircle2 size={15} />
                        <span>{selectedVisit.vendor?.approvalStatus || 'Pending Pincode Admin Approval'}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                        {selectedVisit.vendor?.adminApprovedBy ? `Approved by: ${selectedVisit.vendor.adminApprovedBy}` : 'Awaiting review by Pincode Admin'}
                      </div>
                    </div>

                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: (selectedVisit.vendor?.kycStatus || '').toLowerCase().includes('verified') ? '#ecfdf5' : '#e0f2fe',
                      border: (selectedVisit.vendor?.kycStatus || '').toLowerCase().includes('verified') ? '1px solid #a7f3d0' : '1px solid #bae6fd'
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                        Merchant KYC Status
                      </div>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: (selectedVisit.vendor?.kycStatus || '').toLowerCase().includes('verified') ? '#047857' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <ShieldCheck size={15} />
                        <span>{selectedVisit.vendor?.kycStatus || 'Pending Verification'}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                        Status: <strong style={{ color: '#0f172a' }}>{selectedVisit.vendor?.status || 'Under Review'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 10,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.78rem'
                  }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>Contact Person</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVisit.vendor?.contactPerson || selectedVisit.shopName}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>Phone / Mobile</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVisit.vendor?.phone || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>GST Status</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVisit.vendor?.gstStatus || 'Not Registered'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>Bank Account</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVisit.vendor?.bankName ? `${selectedVisit.vendor.bankName} (•••${(selectedVisit.vendor.accountNumber || '').slice(-4)})` : 'Bank Verified'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Note Recording Section */}
              <div style={{
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mic size={15} style={{ color: '#d97706' }} /> Voice Note Recording &amp; Verbal Audit
                  </div>
                  {selectedVisit.voiceNote && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 7px', borderRadius: 4 }}>
                      Audio Log Attached
                    </span>
                  )}
                </div>

                {selectedVisit.voiceNote ? (
                  <div style={{ padding: '12px', background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <audio controls src={selectedVisit.voiceNote} style={{ width: '100%', height: '36px', outline: 'none' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                    No audio voice note recorded for this visit.
                  </div>
                )}
              </div>

              {/* Not Interested Reason */}
              {selectedVisit.interestedStatus === 'NO' && (
                <div style={{
                  padding: '16px',
                  background: '#fef2f2',
                  borderRadius: '14px',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} /> Reason for Not Interested
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#7f1d1d', lineHeight: '1.4' }}>
                    "{selectedVisit.notInterestedReason || 'Not specified by merchant'}"
                  </div>
                </div>
              )}
            </div>

            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Forge India Connect Field Portal</span>
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.84rem',
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

      {/* Shop Visit Creation Modal */}
      {modalOpen && (
        <ShopVisitModal
          onClose={() => setModalOpen(false)}
          onVisitCreated={(newVisit) => {
            if (newVisit) {
              setVisits(prev => [newVisit, ...prev.filter(v => (v._id || v.id) !== (newVisit._id || newVisit.id))]);
            }
            loadVisits(1);
          }}
        />
      )}

      {/* Generate Report Modal (Period Selector, Live Ingestion, Preview & Confirm) */}
      {isGenerateModalOpen && (
        <GenerateReportModal
          allVisits={visits}
          onClose={() => setIsGenerateModalOpen(false)}
          onReportSubmitted={(newReport) => {
            if (newReport) {
              setSubmittedReports(prev => [newReport, ...prev]);
              setActiveTab('team_reports');
            }
            loadSubmittedReports();
          }}
        />
      )}
    </div>
  );
};

export default Reports;
