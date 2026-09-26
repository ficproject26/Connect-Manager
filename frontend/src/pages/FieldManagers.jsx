import React, { useState, useEffect, useMemo } from 'react';
import { managerService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  MapPin, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Equal, 
  ArrowDownRight, 
  Grid, 
  List, 
  Copy, 
  Eye, 
  X,
  ExternalLink,
  Shield
} from 'lucide-react';

const FieldManagers = () => {
  const { user } = useAuth();
  const [allManagers, setAllManagers] = useState([]);
  const [peersList, setPeersList] = useState([]);
  const [subordinatesList, setSubordinatesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'equal' | 'under'
  const [roleFilter, setRoleFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // Default to clean table view
  const [selectedManager, setSelectedManager] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        setLoading(true);
        const res = await managerService.getManagerDirectory();
        if (res.success) {
          const currentId = user?.id || user?._id;
          const rawAll = res.all || [...(res.peers || []), ...(res.subordinates || res.data || [])];
          const all = rawAll.filter(m => !m.isSelf && m.id !== currentId);
          setAllManagers(all);
          setPeersList((res.peers || all.filter(m => m.relation === 'peer')).filter(m => !m.isSelf && m.id !== currentId));
          setSubordinatesList((res.subordinates || all.filter(m => m.relation === 'subordinate')).filter(m => !m.isSelf && m.id !== currentId));
        }
      } catch (err) {
        console.error('Failed to load manager directory:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchManagers();
  }, [user]);

  const handleCopy = (text, fieldId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'state_manager':
        return (
          <span style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            letterSpacing: '0.2px'
          }}>
            Level 1 • State Manager
          </span>
        );
      case 'district_manager':
        return (
          <span style={{
            background: '#e0f2fe',
            color: '#0369a1',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            letterSpacing: '0.2px'
          }}>
            Level 2 • District Manager
          </span>
        );
      case 'division_manager':
        return (
          <span style={{
            background: '#ecfdf5',
            color: '#047857',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            letterSpacing: '0.2px'
          }}>
            Level 3 • Division Manager
          </span>
        );
      case 'pincode_manager':
        return (
          <span style={{
            background: '#f5f3ff',
            color: '#6d28d9',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            letterSpacing: '0.2px'
          }}>
            Level 4 • Pincode Manager
          </span>
        );
      default:
        return <span>{role}</span>;
    }
  };

  const getRelationBadge = (m) => {
    if (m.isSelf) {
      return (
        <span style={{
          background: '#fef08a',
          color: '#854d0e',
          padding: '4px 9px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap'
        }}>
          ⭐ You (Current)
        </span>
      );
    }
    if (m.relation === 'peer') {
      return (
        <span style={{
          background: '#e0e7ff',
          color: '#3730a3',
          padding: '4px 9px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap'
        }}>
          <Equal size={12} /> Equal Level (Peer)
        </span>
      );
    }
    return (
      <span style={{
        background: '#dcfce7',
        color: '#166534',
        padding: '4px 9px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap'
      }}>
        <ArrowDownRight size={12} /> Under Jurisdiction
      </span>
    );
  };

  const getJurisdictionFormatted = (m) => {
    if (m.pincodeCode) {
      return (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>PIN {m.pincodeCode}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginLeft: '4px' }}>
            ({m.pincodeArea || 'Area'}) • {m.divisionName || m.districtName}
          </span>
        </div>
      );
    }
    if (m.divisionName) {
      return (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{m.divisionName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginLeft: '4px' }}>
            • {m.districtName || m.stateName}
          </span>
        </div>
      );
    }
    if (m.districtName) {
      return (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{m.districtName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginLeft: '4px' }}>
            • {m.stateName || 'State'}
          </span>
        </div>
      );
    }
    return (
      <div>
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{m.stateName || m.state || '-'}</span>
      </div>
    );
  };

  const getAvatarColor = (name = '') => {
    const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  // Filter managers based on tab, search, and role filter
  const filteredManagers = useMemo(() => {
    let sourceList = allManagers;
    if (activeTab === 'equal') {
      sourceList = peersList;
    } else if (activeTab === 'under') {
      sourceList = subordinatesList;
    }

    return sourceList.filter((m) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = m.name?.toLowerCase().includes(q);
        const matchesEmail = m.email?.toLowerCase().includes(q);
        const matchesMobile = m.mobile?.includes(q);
        const matchesArea = m.pincodeArea?.toLowerCase().includes(q);
        const matchesPin = m.pincodeCode?.includes(q);
        const matchesDiv = m.divisionName?.toLowerCase().includes(q);
        const matchesDist = m.districtName?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesMobile && !matchesArea && !matchesPin && !matchesDiv && !matchesDist) {
          return false;
        }
      }
      if (roleFilter !== 'All' && m.role !== roleFilter) return false;
      return true;
    });
  }, [allManagers, peersList, subordinatesList, activeTab, search, roleFilter]);

  const peersCount = peersList.length;
  const subordinatesCount = subordinatesList.length;
  const totalCount = allManagers.length;

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Managers Directory & Team Hierarchy
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Directory of equal-level peers and subordinate managers operating under your assigned hierarchy branch ({totalCount} total)
          </p>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setViewMode('table')}
            style={{
              background: viewMode === 'table' ? '#e2e8f0' : '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: viewMode === 'table' ? 'var(--text-main)' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <List size={15} /> Table View
          </button>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? '#e2e8f0' : '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: viewMode === 'grid' ? 'var(--text-main)' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Grid size={15} /> Card View
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Relation Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                background: activeTab === 'all' ? 'white' : 'transparent',
                color: activeTab === 'all' ? 'var(--text-main)' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'all' ? 700 : 500,
                cursor: 'pointer',
                boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All Managers ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('equal')}
              style={{
                background: activeTab === 'equal' ? 'white' : 'transparent',
                color: activeTab === 'equal' ? '#3730a3' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'equal' ? 700 : 500,
                cursor: 'pointer',
                boxShadow: activeTab === 'equal' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Equal Level ({peersCount})
            </button>
            <button
              onClick={() => setActiveTab('under')}
              style={{
                background: activeTab === 'under' ? 'white' : 'transparent',
                color: activeTab === 'under' ? '#166534' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'under' ? 700 : 500,
                cursor: 'pointer',
                boxShadow: activeTab === 'under' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Under Scope ({subordinatesCount})
            </button>
          </div>

          {/* Search and Dropdown Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px', flex: 1 }}>
              <input
                type="text"
                placeholder="Search manager, email, phone, area..."
                className="form-input"
                style={{ paddingLeft: '34px', height: '36px', fontSize: '0.82rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)' }} />
            </div>

            <select
              className="form-select"
              style={{ minWidth: '180px', maxWidth: '240px', height: '36px', fontSize: '0.82rem' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Hierarchy Levels</option>
              <option value="state_manager">State Managers (Level 1)</option>
              <option value="district_manager">District Managers (Level 2)</option>
              <option value="division_manager">Division Managers (Level 3)</option>
              <option value="pincode_manager">Pincode Managers (Level 4)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Content Area */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={30} style={{ animation: 'pulse 1.5s infinite', margin: '0 auto 10px', color: 'var(--primary)' }} />
          <div style={{ fontSize: '0.88rem' }}>Loading manager hierarchy directory...</div>
        </div>
      ) : filteredManagers.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={34} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
            No managers found
          </div>
          <div style={{ fontSize: '0.82rem' }}>
            {search ? `No managers matching "${search}"` : 'No managers available in this category for your assigned jurisdiction.'}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '180px', textAlign: 'left', paddingLeft: '20px' }}>Manager Profile</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>Relation & Rank</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Hierarchy Level</th>
                <th style={{ minWidth: '175px', textAlign: 'left' }}>Contact Details</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Assigned Jurisdiction</th>
                <th style={{ minWidth: '85px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '90px', textAlign: 'center', paddingRight: '20px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredManagers.map((m) => (
                <tr key={m.id} style={{ background: m.isSelf ? '#fefce8' : 'transparent' }}>
                  <td style={{ paddingLeft: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: getAvatarColor(m.name),
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {m.name ? m.name.slice(0, 1).toUpperCase() : 'M'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </div>
                        <div 
                          title={`Full ID: ${m.id}`} 
                          style={{ 
                            fontSize: '0.72rem', 
                            color: 'var(--text-muted)', 
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.2px'
                          }}
                        >
                          ID: {m.id ? (m.id.length > 12 ? `${m.id.slice(0, 8)}…` : m.id) : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{getRelationBadge(m)}</td>
                  <td>{getRoleBadge(m.role)}</td>
                  <td>
                    <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {m.email}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {m.mobile || '—'}
                    </div>
                  </td>
                  <td>
                    {getJurisdictionFormatted(m)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="status-badge active" style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <span className="status-dot"></span> Active
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                    <button
                      onClick={() => setSelectedManager(m)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filteredManagers.map((m) => {
            const avatarBg = getAvatarColor(m.name);
            return (
              <div 
                key={m.id}
                className="card"
                style={{
                  padding: '18px',
                  borderRadius: '10px',
                  border: m.isSelf ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: avatarBg,
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {m.name ? m.name.slice(0, 1).toUpperCase() : 'M'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {m.id}
                        </div>
                      </div>
                    </div>
                    <div>
                      {getRelationBadge(m)}
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    {getRoleBadge(m.role)}
                  </div>

                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #edf2f7',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    marginBottom: '12px',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Jurisdiction:</div>
                    {getJurisdictionFormatted(m)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', marginBottom: '12px', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} color="#64748b" />
                      <span>{m.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} color="#64748b" />
                      <span>{m.mobile}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="status-badge active" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    <span className="status-dot"></span> Active
                  </span>

                  <button
                    onClick={() => setSelectedManager(m)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={12} />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLEAN DETAILED MANAGER PROFILE MODAL */}
      {selectedManager && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Manager Profile Details
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Hierarchy verification & jurisdiction scope
                </div>
              </div>
              <button 
                onClick={() => setSelectedManager(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* Profile Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: getAvatarColor(selectedManager.name),
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedManager.name ? selectedManager.name.slice(0, 1).toUpperCase() : 'M'}
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedManager.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Manager ID: {selectedManager.id}
                  </div>
                </div>
              </div>

              {/* Status Badges Row */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {getRelationBadge(selectedManager)}
                {getRoleBadge(selectedManager.role)}
                <span className="status-badge active" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  <span className="status-dot"></span> Active
                </span>
              </div>

              {/* Jurisdiction Details Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Assigned Territorial Jurisdiction
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>State:</span>
                    <strong>{selectedManager.stateName || selectedManager.state || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>District:</span>
                    <strong>{selectedManager.districtName || 'All Districts'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Division:</span>
                    <strong>{selectedManager.divisionName || 'All Divisions'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>PIN Code:</span>
                    <strong>{selectedManager.pincodeCode ? `${selectedManager.pincodeCode} (${selectedManager.pincodeArea || ''})` : 'All Pincodes'}</strong>
                  </div>
                </div>
              </div>

              {/* Contact Info Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Contact Information
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                      <Mail size={14} color="#64748b" />
                      <span>{selectedManager.email}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedManager.email, 'modal_email')}
                      style={{
                        background: copiedField === 'modal_email' ? '#dcfce7' : '#f1f5f9',
                        border: copiedField === 'modal_email' ? '1px solid #86efac' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: copiedField === 'modal_email' ? '#15803d' : '#475569',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'modal_email' ? (
                        <>
                          <CheckCircle2 size={13} color="#16a34a" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} color="#64748b" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                      <Phone size={14} color="#64748b" />
                      <span>+91 {selectedManager.mobile}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedManager.mobile, 'modal_phone')}
                      style={{
                        background: copiedField === 'modal_phone' ? '#dcfce7' : '#f1f5f9',
                        border: copiedField === 'modal_phone' ? '1px solid #86efac' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: copiedField === 'modal_phone' ? '#15803d' : '#475569',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'modal_phone' ? (
                        <>
                          <CheckCircle2 size={13} color="#16a34a" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} color="#64748b" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Close Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedManager(null)}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '6px'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldManagers;
