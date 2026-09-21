import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Filter, Search } from 'lucide-react';
import { DEFAULT_ISSUES } from '../services/issuesData';

const Issues = ({ onNavigate }) => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const issuesList = DEFAULT_ISSUES;

  const filtered = issuesList.filter(i => {
    if (filter !== 'All' && i.status !== filter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.vendor.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Territory Issues & Escalations
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Field compliance, payout disputes, and merchant onboarding ticket tracking
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search issue title or vendor name..."
          className="form-input"
          style={{ maxWidth: '350px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select 
          className="form-select"
          style={{ maxWidth: '180px' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Issue Summary</th>
              <th>Vendor Affected</th>
              <th>Territory</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Reported</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong></td>
                <td>{item.title}</td>
                <td>{item.vendor}</td>
                <td>{item.territory}</td>
                <td>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: item.priority === 'High' ? '#dc2626' : item.priority === 'Medium' ? '#d97706' : '#2563eb'
                  }}>
                    ● {item.priority}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${item.status === 'Open' ? 'rejected' : item.status === 'In Progress' ? 'pending' : item.status === 'Escalated' ? 'rejected' : 'active'}`}>
                    {item.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.reportedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Issues;
