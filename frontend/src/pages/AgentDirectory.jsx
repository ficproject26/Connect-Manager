import React, { useState, useEffect, useMemo } from 'react';
import { agentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../realtime';
import { getDisplayValue, normalizeString } from '../utils/normalize';
import { 
  UserCheck, 
  Search, 
  MapPin, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Grid, 
  List, 
  Copy, 
  Eye, 
  X,
  ExternalLink,
  Shield,
  Award,
  Wallet,
  Store,
  Users,
  RefreshCw,
  Building2,
  Layers,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

const AgentDirectory = ({ onNavigate }) => {
  const { user, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const fetchAgents = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      setLoading(true);
      setError(null);
      const res = await agentService.getAgents({}, user);
      if (res && res.success) {
        const list = (Array.isArray(res.agents) ? res.agents : (Array.isArray(res.data) ? res.data : [])) || [];
        setAgents(list);
      } else {
        setError(res?.message || 'Failed to load agent directory');
        setAgents([]);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
      setError(err?.message || 'Network error while loading agent directory');
      setAgents([]);
    } finally {
      setLoading(false);
      if (showSpinner) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchAgents();
    }
  }, [user, authLoading]);

  // Real-time synchronization for agent directory
  useRealtime('agent', () => {
    fetchAgents(false);
  });

  const handleCopy = (text, fieldId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resolveLevelStr = (level, role) => {
    const rawRole = normalizeString(role).toLowerCase();
    const rawLevel = level;
    if (rawLevel === 1 || rawLevel === '1' || rawRole.includes('state')) return 'state';
    if (rawLevel === 2 || rawLevel === '2' || rawRole.includes('district')) return 'district';
    if (rawLevel === 3 || rawLevel === '3' || rawRole.includes('division') || rawRole.includes('divisional')) return 'division';
    if (rawLevel === 4 || rawLevel === '4' || rawRole.includes('pincode')) return 'pincode';
    return normalizeString(rawLevel || rawRole || '').toLowerCase();
  };

  const getLevelBadge = (role, level) => {
    const l = resolveLevelStr(level, role);
    if (l.includes('state')) {
      return (
        <span style={{
          background: '#f3e8ff',
          color: '#7e22ce',
          border: '1px solid #d8b4fe',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Award size={11} /> State Agent
        </span>
      );
    }
    if (l.includes('district')) {
      return (
        <span style={{
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Building2 size={11} /> District Agent
        </span>
      );
    }
    if (l.includes('divisional') || l.includes('division')) {
      return (
        <span style={{
          background: '#ecfdf5',
          color: '#047857',
          border: '1px solid #a7f3d0',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Layers size={11} /> Divisional Agent
        </span>
      );
    }
    return (
      <span style={{
        background: '#fef3c7',
        color: '#b45309',
        border: '1px solid #fde68a',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <MapPin size={11} /> Pincode Agent
      </span>
    );
  };

  const managerRole = (user?.role || '').toLowerCase().replace(/_/g, ' ');
  const isPincodeManager = managerRole.includes('pincode');
  const isDivisionManager = managerRole.includes('division') || managerRole.includes('divisional');
  const isDistrictManager = managerRole.includes('district');
  const isStateManager = managerRole.includes('state');

  // Hierarchical Scoping Rules:
  // Hierarchical Scoping Rules:
  // agents returned by agentService.getAgents are already strictly scoped to the manager's authorized territory
  const hierarchicalAgents = useMemo(() => {
    return agents;
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return hierarchicalAgents.filter(agent => {
      if (levelFilter !== 'All') {
        const l = resolveLevelStr(agent.level, agent.role);
        if (levelFilter === 'state' && !l.includes('state')) return false;
        if (levelFilter === 'district' && !l.includes('district')) return false;
        if (levelFilter === 'divisional' && !l.includes('division')) return false;
        if (levelFilter === 'pincode' && !l.includes('pincode')) return false;
      }

      if (statusFilter !== 'All' && agent.status !== statusFilter) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (agent.name && agent.name.toLowerCase().includes(q)) ||
                      (agent.email && agent.email.toLowerCase().includes(q)) ||
                      (agent.phone && agent.phone.includes(q)) ||
                      (agent.jurisdiction && agent.jurisdiction.toLowerCase().includes(q)) ||
                      (agent.assignedArea && agent.assignedArea.toLowerCase().includes(q)) ||
                      (agent.pincode && agent.pincode.includes(q)) ||
                      (agent.id && agent.id.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [hierarchicalAgents, search, levelFilter, statusFilter]);

  const totalReferrals = useMemo(() => {
    return hierarchicalAgents.reduce((sum, a) => sum + (a.totalReferrals || 0), 0);
  }, [hierarchicalAgents]);

  const totalVendors = useMemo(() => {
    return hierarchicalAgents.reduce((sum, a) => sum + (a.vendorOnboardings || 0), 0);
  }, [hierarchicalAgents]);

  const resolvedPincode = user?.pincode || user?.pincodeCode || user?.scope?.pincodeCode || '';
  const resolvedDivision = user?.division || user?.divisionName || user?.scope?.divisionName || '';
  const resolvedDistrict = user?.district || user?.districtName || user?.scope?.districtName || '';
  const resolvedState = user?.state || user?.stateName || user?.scope?.stateName || '';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* 1. Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Agent Directory & Field Force
            </h2>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              background: '#eff6ff', 
              color: '#2563eb', 
              padding: '2px 8px', 
              borderRadius: '20px',
              border: '1px solid #bfdbfe'
            }}>
              {hierarchicalAgents.length} Total Agents
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            {isPincodeManager 
              ? `Pincode Field Agents operating under PIN ${resolvedPincode || 'Assigned Territory'}${resolvedDivision ? ` (${resolvedDivision})` : ''}`
              : isDivisionManager
              ? `Division & Pincode Agents operating under ${resolvedDivision || 'Assigned'} Division`
              : isDistrictManager
              ? `District, Division & Pincode Agents operating across ${resolvedDistrict || 'Assigned'} District`
              : isStateManager
              ? `State, District, Division & Pincode Agents operating across ${resolvedState || 'Assigned Territory'}`
              : 'Ground customer onboarding agents, lead distributors, and franchise partners operating under your jurisdiction'
            }
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Table / Card View Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '3px'
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? '#eff6ff' : 'transparent',
                color: viewMode === 'table' ? '#2563eb' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <List size={14} /> Table View
            </button>
            <button
              onClick={() => setViewMode('card')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'card' ? '#eff6ff' : 'transparent',
                color: viewMode === 'card' ? '#2563eb' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <Grid size={14} /> Card View
            </button>
          </div>

          <button
            onClick={() => fetchAgents(true)}
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
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="tasks-kpi-grid">
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Total Field Agents
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {hierarchicalAgents.length}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} />
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Active on Ground
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {hierarchicalAgents.filter(a => a.status === 'Active').length}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Total Referrals
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
              {totalReferrals}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} />
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px 20px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Vendors Onboarded
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
              {totalVendors}
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ede9fe', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={20} />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
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
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search agent by name, email, phone, PIN, area..."
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
        </div>

        {!isPincodeManager && (
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
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
            <option value="All">All Hierarchy Levels</option>
            {isStateManager && <option value="state">State Agents</option>}
            {(isStateManager || isDistrictManager) && <option value="district">District Agents</option>}
            {(isStateManager || isDistrictManager || isDivisionManager) && <option value="divisional">Divisional Agents</option>}
            <option value="pincode">Pincode Agents</option>
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
          <option value="Active">Active</option>
          <option value="Pending KYC">Pending KYC</option>
        </select>

        {(search || levelFilter !== 'All' || statusFilter !== 'All') && (
          <button
            onClick={() => {
              setSearch('');
              setLevelFilter('All');
              setStatusFilter('All');
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
            Reset Filters
          </button>
        )}
      </div>

      {/* 4. Directory Content */}
      {loading ? (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <UserCheck size={36} style={{ animation: 'pulse 1.5s infinite', margin: '0 auto 10px', color: 'var(--primary)' }} />
          <div style={{ fontSize: '0.88rem' }}>Loading field agent directory...</div>
        </div>
      ) : error ? (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Shield size={34} style={{ margin: '0 auto 10px', color: '#ef4444' }} />
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#b91c1c', marginBottom: '4px' }}>
            {error}
          </div>
          <button
            onClick={() => fetchAgents(true)}
            className="btn btn-primary btn-sm"
            style={{ marginTop: '12px', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Retry Loading
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Agent Profile</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Jurisdiction & Coverage</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Role Level</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Activations</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Wallet</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <UserCheck size={36} style={{ color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>No agents found</div>
                        <div style={{ fontSize: '0.8rem' }}>
                          {search
                            ? `No agents match "${search}".`
                            : isPincodeManager
                            ? `No field agents are currently registered under PIN ${resolvedPincode || 'your assigned territory'}.`
                            : 'No agents match your current territory or filter criteria.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map(agent => (
                    <tr 
                      key={agent._id || agent.id}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Profile */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem'
                          }}>
                            {(getDisplayValue(agent.name, 'Ag')).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                              {getDisplayValue(agent.name, 'Agent')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {getDisplayValue(agent.id || agent.agentCode, '—')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Jurisdiction */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {getDisplayValue(agent.jurisdiction, 'Assigned Territory')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <MapPin size={11} /> {getDisplayValue(agent.assignedArea, 'Assigned Zone')}
                        </div>
                      </td>

                      {/* Role Level */}
                      <td style={{ padding: '14px 16px' }}>
                        {getLevelBadge(agent.role, agent.level)}
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>
                            {agent.phone}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(agent.phone, `phone-${agent.id}`)}
                            title="Copy phone"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === `phone-${agent.id}` ? '#059669' : '#94a3b8', padding: '2px' }}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {agent.email}
                        </div>
                      </td>

                      {/* Activations */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem' }}>
                          {agent.totalReferrals || 0} Referrals
                        </div>
                        <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>
                          {agent.vendorOnboardings || 0} Vendors
                        </div>
                      </td>

                      {/* Wallet */}
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#059669', fontSize: '0.84rem' }}>
                        ₹{(agent.walletBalance || 0).toLocaleString()}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: agent.status === 'Active' ? '#d1fae5' : '#fef3c7',
                          color: agent.status === 'Active' ? '#065f46' : '#92400e'
                        }}>
                          {agent.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedAgent(agent)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            color: 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
          gap: '16px'
        }}>
          {filteredAgents.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserCheck size={36} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>No agents found</div>
              <div style={{ fontSize: '0.8rem' }}>
                {search
                  ? `No agents match "${search}".`
                  : isPincodeManager
                  ? `No field agents are currently registered under PIN ${resolvedPincode || 'your assigned territory'}.`
                  : 'No agents match your current territory or filter criteria.'}
              </div>
            </div>
          ) : (
            filteredAgents.map(agent => (
            <div 
              key={agent._id || agent.id}
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.92rem'
                    }}>
                      {(getDisplayValue(agent.name, 'Ag')).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {getDisplayValue(agent.name, 'Agent')}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {getDisplayValue(agent.id, '—')}
                      </span>
                    </div>
                  </div>
                  {getLevelBadge(agent.role, agent.level)}
                </div>

                <div style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                    <MapPin size={13} style={{ color: '#0284c7' }} />
                    <span>{getDisplayValue(agent.jurisdiction, 'Assigned Territory')}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '19px' }}>
                    {getDisplayValue(agent.assignedArea, 'Assigned Zone')}
                  </div>
                </div>

                <div className="responsive-grid-2" style={{ gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ background: '#fdf4ff', border: '1px solid #fae8ff', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#86198f', fontWeight: 700 }}>REFERRALS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#701a75', marginTop: '2px' }}>{agent.totalReferrals || 0}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#166534', fontWeight: 700 }}>VENDORS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>{agent.vendorOnboardings || 0}</div>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid var(--border)'
              }}>
                <span style={{
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#059669'
                }}>
                  Wallet: ₹{(agent.walletBalance || 0).toLocaleString()}
                </span>
                <button
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  View Profile
                </button>
              </div>
            </div>
          )))}
        </div>
      )}

      {/* 5. Agent Profile Modal */}
      {selectedAgent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px'
        }}>
          <div 
            onClick={() => setSelectedAgent(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
          />

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '540px',
            maxHeight: 'min(92vh, 800px)',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1rem'
                }}>
                  {selectedAgent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {selectedAgent.name}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {selectedAgent.id} • {selectedAgent.role}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
              <div className="responsive-grid-2" style={{
                gap: '12px',
                background: '#f8fafc',
                padding: '14px',
                borderRadius: '10px',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {selectedAgent.phone}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedAgent.email}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned Territory</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedAgent.jurisdiction}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Coverage Area</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedAgent.assignedArea}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Supervisor</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedAgent.supervisorName || 'Hierarchy Lead'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>KYC Status</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {selectedAgent.kycStatus || 'Verified'}
                  </div>
                </div>
              </div>

              <div className="responsive-grid-3" style={{
                gap: '10px',
                marginBottom: '16px'
              }}>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>REFERRALS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{selectedAgent.totalReferrals || 0}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>VENDORS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{selectedAgent.vendorOnboardings || 0}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>COMMISSION</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'monospace' }}>
                    ₹{(selectedAgent.commissionEarned || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingTop: '14px',
                borderTop: '1px solid var(--border)'
              }}>
                <button
                  onClick={() => setSelectedAgent(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    cursor: 'pointer'
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

export default AgentDirectory;
