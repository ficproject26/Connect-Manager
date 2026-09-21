import React, { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import { History, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await auditService.getAuditLogs();
        if (res.success) setLogs(res.data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'Vendor Created': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'Vendor Approved': return { bg: '#dcfce7', text: '#15803d' };
      case 'Vendor Rejected': return { bg: '#fee2e2', text: '#b91c1c' };
      case 'Status Changed': return { bg: '#fef3c7', text: '#b45309' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit Trail & Compliance Log</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Traceability of all vendor registrations, status transitions, and modifications within your jurisdiction
        </p>
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
                  No audit logs found for your assigned scope.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const color = getActionBadgeColor(log.action);
                return (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
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
                      <div style={{ fontWeight: 600 }}>{log.userName || 'System'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {log.userRole?.replace('_', ' ') || 'Manager'}
                      </div>
                    </td>
                    <td>
                      <code>{log.recordId}</code>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {log.previousValue ? (
                        <pre style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                          {JSON.stringify(log.previousValue, null, 1)}
                        </pre>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>None (Initial)</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <pre style={{ margin: 0, fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>
                        {JSON.stringify(log.newValue, null, 1)}
                      </pre>
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
