import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Filter,
  User,
  MapPin,
  Tag,
  ChevronRight,
  X,
  Check,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { issueService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { resolveUserTerritoryProfile } from '../utils/territoryScoping';

const Issues = ({ onNavigate, filterParams }) => {
  const { user } = useAuth();
  const territoryProfile = useMemo(() => resolveUserTerritoryProfile(user), [user]);

  const [issues, setIssues] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, inProgress: 0, escalated: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Selected issue for details/update modal
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Handle incoming filter params from Dashboard navigation
  useEffect(() => {
    if (filterParams?.status) {
      const s = String(filterParams.status).trim().toLowerCase();
      if (['open', 'pending'].includes(s)) setStatusFilter('Open');
      else if (['in progress', 'progress', 'in_progress'].includes(s)) setStatusFilter('In Progress');
      else if (['escalated', 'urgent'].includes(s)) setStatusFilter('Escalated');
      else if (['resolved', 'closed', 'completed'].includes(s)) setStatusFilter('Resolved');
      else setStatusFilter('All');
    }
  }, [filterParams]);

  const fetchIssues = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await issueService.getIssues({
        status: statusFilter,
        priority: priorityFilter,
        search: search.trim()
      });

      if (res && res.success) {
        setIssues(Array.isArray(res.data) ? res.data : []);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err) {
      console.error('Failed to load territory issues:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [user, statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchIssues();
  };

  const handleOpenDetailModal = (issue) => {
    setSelectedIssue(issue);
    setModalStatus(issue.status);
    setModalNotes(issue.resolutionNotes || '');
    setUpdateError('');
    setUpdateSuccess('');
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setUpdating(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      const res = await issueService.updateIssueStatus(
        selectedIssue._id || selectedIssue.id,
        modalStatus,
        modalNotes
      );
      if (res && res.success) {
        setUpdateSuccess(`Status updated to ${modalStatus} successfully!`);
        // Update local list
        setIssues(prev => prev.map(item => 
          (item._id === selectedIssue._id || item.id === selectedIssue.id)
            ? { ...item, status: modalStatus, resolutionNotes: modalNotes, updatedAt: new Date().toISOString() }
            : item
        ));
        // Update counts
        setTimeout(() => {
          setSelectedIssue(null);
          fetchIssues(true);
        }, 1200);
      } else {
        setUpdateError(res?.message || 'Failed to update issue status.');
      }
    } catch (err) {
      setUpdateError(err.message || 'Error updating status.');
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityBadgeStyle = (priority) => {
    switch (priority) {
      case 'Urgent':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', dot: '#dc2626' };
      case 'High':
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a', dot: '#d97706' };
      case 'Medium':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', dot: '#0284c7' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', dot: '#64748b' };
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Resolved':
        return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', label: 'Resolved' };
      case 'Escalated':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', label: 'Escalated' };
      case 'In Progress':
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a', label: 'In Progress' };
      default:
        return { bg: '#fee2e2', color: '#ef4444', border: '#fecaca', label: 'Open' };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Page Header */}
      <div style={{
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Territory Issues & Escalations
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid #fecaca'
            }}>
              {counts.open + counts.inProgress + counts.escalated} Active
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            {territoryProfile.level === 'pincode' && `Field disputes and support tickets strictly scoped to PIN ${territoryProfile.pincode || 'Assigned Territory'}`}
            {territoryProfile.level === 'division' && `Field disputes and support tickets strictly scoped to ${territoryProfile.division || 'Assigned'} Division`}
            {territoryProfile.level === 'district' && `Field disputes and support tickets strictly scoped to ${territoryProfile.district || 'Assigned'} District`}
            {territoryProfile.level === 'state' && `Field disputes and support tickets strictly scoped to ${territoryProfile.state || 'Assigned'} State`}
            {territoryProfile.level === 'admin' && 'Central Field Operations & System Tickets (All Territories)'}
            {!['pincode', 'division', 'district', 'state', 'admin'].includes(territoryProfile.level) && 'Field disputes and operational tickets'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchIssues(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Issues'}</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Status KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Total Issues */}
        <div
          onClick={() => setStatusFilter('All')}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 18px',
            border: statusFilter === 'All' ? '2px solid #6366f1' : '1px solid var(--border)',
            boxShadow: statusFilter === 'All' ? '0 4px 12px rgba(99, 102, 241, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Total Issues
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {counts.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {statusFilter === 'All' ? '● Currently viewing all' : 'Click to show all'}
          </div>
        </div>

        {/* Open */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Open' ? 'All' : 'Open')}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 18px',
            border: statusFilter === 'Open' ? '2px solid #ef4444' : '1px solid var(--border)',
            boxShadow: statusFilter === 'Open' ? '0 4px 12px rgba(239, 68, 68, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444' }}>
              Open
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
            {counts.open}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {statusFilter === 'Open' ? '● Filter active' : 'Click to filter'}
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'In Progress' ? 'All' : 'In Progress')}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 18px',
            border: statusFilter === 'In Progress' ? '2px solid #f59e0b' : '1px solid var(--border)',
            boxShadow: statusFilter === 'In Progress' ? '0 4px 12px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#d97706' }}>
              In Progress
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
            {counts.inProgress}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {statusFilter === 'In Progress' ? '● Filter active' : 'Click to filter'}
          </div>
        </div>

        {/* Escalated */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Escalated' ? 'All' : 'Escalated')}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 18px',
            border: statusFilter === 'Escalated' ? '2px solid #0284c7' : '1px solid var(--border)',
            boxShadow: statusFilter === 'Escalated' ? '0 4px 12px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#0284c7' }}>
              Escalated
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
            {counts.escalated}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {statusFilter === 'Escalated' ? '● Filter active' : 'Click to filter'}
          </div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Resolved' ? 'All' : 'Resolved')}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 18px',
            border: statusFilter === 'Resolved' ? '2px solid #10b981' : '1px solid var(--border)',
            boxShadow: statusFilter === 'Resolved' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#15803d' }}>
              Resolved
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {counts.resolved}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {statusFilter === 'Resolved' ? '● Filter active' : 'Click to filter'}
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Controls */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '14px 18px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search ticket ID, title, description, agent, or PIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '0.84rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </form>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by issue status"
          style={{
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#ffffff',
            outline: 'none',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
        </select>

        {/* Priority Dropdown */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by issue priority"
          style={{
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#ffffff',
            outline: 'none',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <option value="All">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Clear Filters Button */}
        {(statusFilter !== 'All' || priorityFilter !== 'All' || search) && (
          <button
            onClick={() => {
              setStatusFilter('All');
              setPriorityFilter('All');
              setSearch('');
            }}
            style={{
              padding: '8px 12px',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px dashed var(--border)',
              background: '#f8fafc',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 4. Issues Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--forge-gold)' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>Loading territory issue records...</p>
          </div>
        ) : issues.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#f1f5f9',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <CheckCircle2 size={24} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-main)' }}>
              No Issues Found
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
              {statusFilter !== 'All'
                ? `No territory issues matching status "${statusFilter}". Try selecting a different filter.`
                : 'All issues in your assigned territory are currently resolved or none have been logged.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ticket ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Issue Summary</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reported By</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Territory</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Priority</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reported</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((item) => {
                  const priStyle = getPriorityBadgeStyle(item.priority);
                  const stStyle = getStatusBadgeStyle(item.status);
                  const formattedDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/A';

                  return (
                    <tr
                      key={item._id || item.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                      onClick={() => handleOpenDetailModal(item)}
                    >
                      {/* Ticket ID */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          background: '#f1f5f9',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          color: '#0f172a'
                        }}>
                          {item.ticketId}
                        </span>
                      </td>

                      {/* Issue Summary */}
                      <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a', marginBottom: '2px' }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#ede9fe',
                          color: '#6d28d9'
                        }}>
                          <Tag size={11} />
                          {item.category}
                        </span>
                      </td>

                      {/* Reported By */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                          {item.creatorName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {item.creatorRole?.replace('_', ' ')}
                        </div>
                      </td>

                      {/* Territory */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                          <MapPin size={12} color="#64748b" />
                          <span>{item.district || item.state || 'Territory'}</span>
                        </div>
                        {item.pincode && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '16px' }}>
                            PIN {item.pincode}
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: priStyle.bg,
                          color: priStyle.color,
                          border: `1px solid ${priStyle.border}`
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: priStyle.dot }} />
                          {item.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: stStyle.bg,
                          color: stStyle.color,
                          border: `1px solid ${stStyle.border}`
                        }}>
                          {stStyle.label}
                        </span>
                      </td>

                      {/* Reported Date */}
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formattedDate}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal(item);
                          }}
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Manage</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Issue Detail & Status Update Modal */}
      {selectedIssue && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: '#e2e8f0',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {selectedIssue.ticketId}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    ...getStatusBadgeStyle(selectedIssue.status)
                  }}>
                    {selectedIssue.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '6px 0 0', color: '#0f172a' }}>
                  {selectedIssue.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Feedback banners */}
              {updateSuccess && (
                <div style={{
                  padding: '10px 14px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#15803d',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{updateSuccess}</span>
                </div>
              )}
              {updateError && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{updateError}</span>
                </div>
              )}

              {/* Details Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '18px',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '0.82rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Category</span>
                  <span style={{ fontWeight: 700, color: '#334155' }}>{selectedIssue.category}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Priority</span>
                  <span style={{ fontWeight: 700, color: getPriorityBadgeStyle(selectedIssue.priority).color }}>{selectedIssue.priority}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Reported By</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{selectedIssue.creatorName} ({selectedIssue.creatorRole})</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Territory</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {selectedIssue.district || selectedIssue.state || 'Assigned'}
                    {selectedIssue.pincode ? ` (${selectedIssue.pincode})` : ''}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Description & Context
                </label>
                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.84rem',
                  lineHeight: '1.45',
                  color: '#1e293b'
                }}>
                  {selectedIssue.description}
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleSaveStatus}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Update Status
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Escalated">Escalated</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Resolution Notes / Action Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter resolution notes, corrective action taken, or escalation reason..."
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '0.84rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedIssue(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--forge-gold, #f59e0b)',
                      color: '#0f172a',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: updating ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {updating ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        <span>Save Status</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Issues;
