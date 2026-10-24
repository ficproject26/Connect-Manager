import React, { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import { History, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRealtime } from '../realtime';
import { useAuth } from '../context/AuthContext';

const AuditLogs = ({ onNavigate }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await auditService.getAuditLogs();
      if (res.success && Array.isArray(res.data)) {
        const uState = String(user?.state || user?.stateName || user?.scope?.stateName || '').toLowerCase();
        const uStateId = String(user?.stateId || user?.scope?.stateId || '').toLowerCase();
        const isKa = uState.includes('karnataka') || uStateId === 'state_ka';
        const isTn = uState.includes('tamil nadu') || uStateId === 'state_tn' || uStateId === '6aa10f70ca0932e6eaec1f5c';
        const tnLocs = ['tamil nadu', 'kallakurichi', 'salem', 'dharmapuri', 'chennai', 'krishnagiri', 'hosur', 'coimbatore', 'madurai'];
        const kaLocs = ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'hubli'];

        const scoped = res.data.filter(l => {
          const txt = `${l.action || ''} ${l.targetName || ''} ${JSON.stringify(l.newValue || {})} ${JSON.stringify(l.previousValue || {})}`.toLowerCase();
          if (isKa && tnLocs.some(loc => txt.includes(loc))) return false;
          if (isTn && kaLocs.some(loc => txt.includes(loc))) return false;
          return true;
        });
        setLogs(scoped);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useRealtime('audit', (event) => {
    if (event.action === 'created' && event.data) {
      setLogs((prev) => [event.data, ...prev.filter(l => (l._id || l.id) !== (event.data._id || event.data.id))]);
    }
  });
  useRealtime('audit_logs', (event) => {
    if (event.action === 'created' && event.data) {
      setLogs((prev) => [event.data, ...prev.filter(l => (l._id || l.id) !== (event.data._id || event.data.id))]);
    }
  });

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'Vendor Created': return { bg: 'rgba(2, 132, 199, 0.15)', text: '#0284c7' };
      case 'Vendor Approved': return { bg: 'rgba(22, 163, 74, 0.15)', text: '#16a34a' };
      case 'Vendor Rejected': return { bg: 'rgba(220, 38, 38, 0.15)', text: '#dc2626' };
      case 'Status Changed': return { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706' };
      default: return { bg: 'var(--bg-subtle)', text: 'var(--text-muted)' };
    }
  };

  const formatSafeTimestamp = (timestamp) => {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const renderTargetRecord = (log) => {
    const rawId = log.recordId || log.targetId || log.metadata?.vendorId || '';
    const name = log.targetName || log.metadata?.vendorName || log.targetRecordName || null;

    if (!rawId && !name) {
      return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Record unavailable</span>;
    }

    const shortId = rawId && rawId.length > 14 ? `${rawId.slice(0, 8)}...${rawId.slice(-4)}` : rawId;

    return (
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
          {name || 'Record unavailable'}
        </div>
        {rawId && (
          <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 4 }}>
            {shortId}
          </code>
        )}
      </div>
    );
  };

  const renderStateFields = (val, isPrevious = false, action = '') => {
    if (!val) {
      const isCreate = String(action).toLowerCase().includes('create');
      if (isPrevious && isCreate) {
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>None (Initial)</span>;
      }
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontStyle: 'italic' }}>Not available</span>;
    }

    let parsed = val;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{String(val)}</span>;
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{String(parsed)}</span>;
    }

    const entries = Object.entries(parsed).filter(([k]) => !k.startsWith('_') && k !== '__v');
    if (entries.length === 0) {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontStyle: 'italic' }}>Not available</span>;
    }

    const formatKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '280px' }}>
        {entries.slice(0, 4).map(([k, v]) => {
          let strVal = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
          if (strVal.length > 28) strVal = strVal.slice(0, 25) + '...';
          return (
            <div key={k} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{formatKey(k)}:</span>
              <strong style={{ color: isPrevious ? 'var(--text-muted)' : 'var(--text-main)' }}>{strVal}</strong>
            </div>
          );
        })}
        {entries.length > 4 && (
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>+{entries.length - 4} more fields</span>
        )}
      </div>
    );
  };

  const jurisdictionLabel = user?.role === 'pincode_manager'
    ? (user.pincode || user.pincodeCode ? `PIN ${user.pincode || user.pincodeCode}` : 'Assigned Pincode')
    : user?.role === 'division_manager'
      ? (user.division || user.divisionName ? `${user.division || user.divisionName} Division` : 'Assigned Division')
      : user?.role === 'district_manager'
        ? (user.district || user.districtName ? `${user.district || user.districtName} District` : 'Assigned District')
        : (user?.state || user?.stateName || user?.scope?.stateName ? `${user?.state || user?.stateName || user?.scope?.stateName} State` : 'Assigned State');

  return (
    <div>
      {onNavigate && (
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            marginBottom: '16px',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--text-main, #0f172a)',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
      )}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit Trail &amp; Compliance Log</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Traceability of all vendor registrations, status transitions, and modifications within your assigned jurisdiction
          </p>
        </div>
        {jurisdictionLabel && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(22, 163, 74, 0.12)',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            color: '#22c55e',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            <Shield size={14} /> Scoped: {jurisdictionLabel}
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Taken</th>
              <th>Operated By</th>
              <th>Target Record</th>
              <th>Previous State</th>
              <th>New State</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>Loading audit records...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No audit logs found for your assigned jurisdiction ({jurisdictionLabel}).
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => {
                const color = getActionBadgeColor(log.action);
                return (
                  <tr key={log._id || log.id || idx}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatSafeTimestamp(log.timestamp || log.createdAt || log.updatedAt)}
                    </td>
                    <td>
                      <span style={{
                        background: color.bg,
                        color: color.text,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.userName || log.userEmail?.split('@')[0] || 'System'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {log.userRole?.replace('_', ' ') || 'Manager'}
                      </div>
                    </td>
                    <td>
                      {renderTargetRecord(log)}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {renderStateFields(log.previousValue, true, log.action)}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {renderStateFields(log.newValue, false, log.action)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
