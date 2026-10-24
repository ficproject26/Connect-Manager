import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/api';
import { cacheClient } from '../services/cacheClient';
import { 
  Trophy, 
  Award, 
  Medal, 
  TrendingUp, 
  Star, 
  MapPin, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Flame, 
  CheckCircle, 
  Users,
  Store,
  Clock
} from 'lucide-react';

const Leaderboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month'); // 'month' | 'quarter' | 'year'
  const [tierFilter, setTierFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [allRankings, setAllRankings] = useState(() => {
    const raw = cacheClient.get('leaderboard')?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  });
  const [loading, setLoading] = useState(() => !cacheClient.get('leaderboard')?.data);

  const stateName = user?.scope?.stateName || user?.scope?.regionName || user?.state || '-';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const cacheKey = `leaderboard_${period}`;
        const res = await cacheClient.fetchWithCache(cacheKey, () => reportService.getLeaderboardData({ period }));
        if (res && res.success) {
          const list = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          setAllRankings(list);
        }
      } catch (err) {
        console.error('Failed to fetch live leaderboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [user, period]);

  const tierRankings = useMemo(() => {
    const safeRankings = Array.isArray(allRankings) ? allRankings : [];
    const list = safeRankings.filter((m) => {
      // Strictly exclude any unapproved, pending, or inactive managers from leaderboard
      const st = String(m.status || 'active').toLowerCase().trim();
      const ost = String(m.overallRegistrationStatus || '').toLowerCase().trim();
      if (st.includes('pending') || st.includes('review') || st.includes('reject')) return false;
      if (ost.includes('pending') || ost.includes('review') || ost.includes('reject')) return false;
      if (m.isActive === false || m.isApproved === false) return false;

      if (tierFilter === 'All') return true;
      const r = String(m.role || '').toLowerCase();
      const tf = String(tierFilter || '').toLowerCase();
      return r === tf || r.includes(tf.replace('_manager', ''));
    });
    return list.map((m, idx) => ({
      ...m,
      displayRank: tierFilter === 'All' ? m.rank : idx + 1
    }));
  }, [allRankings, tierFilter]);

  const filteredRankings = useMemo(() => {
    const safeTier = Array.isArray(tierRankings) ? tierRankings : [];
    return safeTier.filter((m) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = m.name?.toLowerCase().includes(q);
        const matchesTerritory = m.territory?.toLowerCase().includes(q);
        const matchesRole = m.roleLabel?.toLowerCase().includes(q);
        if (!matchesName && !matchesTerritory && !matchesRole) return false;
      }
      return true;
    });
  }, [tierRankings, search]);

  const top3 = useMemo(() => {
    const safeTier = Array.isArray(tierRankings) ? tierRankings : [];
    return safeTier.slice(0, 3);
  }, [tierRankings]);

  const getTopLeaderBadgeText = () => {
    switch (tierFilter) {
      case 'state_manager': return '🥇 TOP STATE LEADER';
      case 'district_manager': return '🥇 TOP DISTRICT LEADER';
      case 'division_manager': return '🥇 TOP DIVISION LEADER';
      case 'pincode_manager': return '🥇 TOP PINCODE LEADER';
      default: return '🥇 TOP LEADER';
    }
  };

  const getRankMedal = (rank) => {
    if (rank === 1) return <span style={{ fontSize: '1.3rem' }}>🥇</span>;
    if (rank === 2) return <span style={{ fontSize: '1.3rem' }}>🥈</span>;
    if (rank === 3) return <span style={{ fontSize: '1.3rem' }}>🥉</span>;
    return <span style={{ fontWeight: 800, color: '#64748b', fontSize: '0.95rem' }}>#{rank}</span>;
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'state_manager':
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 1 • State Manager</span>;
      case 'district_manager':
        return <span style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 2 • District Manager</span>;
      case 'division_manager':
        return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 3 • Division Manager</span>;
      case 'pincode_manager':
        return <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 4 • Pincode Manager</span>;
      default:
        return <span>{role}</span>;
    }
  };

  const renderGoldCard = (card) => {
    if (!card) return null;
    return (
      <div 
        key={card.id + '-gold'}
        className="card" 
        style={{ 
          padding: '20px 22px', 
          borderRadius: '12px', 
          border: '2px solid #f59e0b', 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, var(--bg-card) 100%)', 
          boxShadow: '0 8px 20px rgba(245, 158, 11, 0.15)', 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '168px'
        }}
      >
        <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '1.8rem' }}>👑</div>
        <div>
          <div style={{ display: 'inline-block', background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {getTopLeaderBadgeText()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f59e0b', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(245, 158, 11, 0.25)', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>SCORE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{card.points.toLocaleString()} pts</div>
          </div>
        </div>
      </div>
    );
  };

  const renderSilverCard = (card) => {
    if (!card) return null;
    return (
      <div 
        key={card.id + '-silver'}
        className="card" 
        style={{ 
          padding: '18px 20px', 
          borderRadius: '12px', 
          border: '1px solid var(--border-normal)', 
          background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, var(--bg-card) 100%)', 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '168px'
        }}
      >
        <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '1.6rem' }}>🥈</div>
        <div>
          <div style={{ display: 'inline-block', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🥈 2ND PLACE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-normal)', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCORE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#6366f1' }}>{card.points.toLocaleString()} pts</div>
          </div>
        </div>
      </div>
    );
  };

  const renderBronzeCard = (card) => {
    if (!card) return null;
    return (
      <div 
        key={card.id + '-bronze'}
        className="card" 
        style={{ 
          padding: '18px 20px', 
          borderRadius: '12px', 
          border: '1px solid rgba(217, 119, 6, 0.4)', 
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, var(--bg-card) 100%)', 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '168px'
        }}
      >
        <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '1.6rem' }}>🥉</div>
        <div>
          <div style={{ display: 'inline-block', background: 'rgba(217, 119, 6, 0.18)', color: '#d97706', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🥉 3RD PLACE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(217, 119, 6, 0.25)', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCORE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#d97706' }}>{card.points.toLocaleString()} pts</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Manager Performance Leaderboard
            </h2>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '0.75rem', fontWeight: 800, padding: '3px 9px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Trophy size={13} color="#d97706" /> Live Database Rankings
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Real-time benchmarking of agent managers by live verified vendor accounts, KYC inspection velocity, and territory coverage.
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', gap: '3px' }}>
          {['month', 'quarter', 'year', 'all'].map((p) => {
            const labels = { month: 'This Month', quarter: 'This Quarter', year: 'Full Year', all: 'All Time' };
            const isActive = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  background: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Podium Showcase - Changes dynamically with State, District, Division, Pincode */}
      {top3.length > 0 && (
        <div 
          key={tierFilter}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: top3.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', 
            gap: '16px', 
            marginBottom: '22px' 
          }}
        >
          {top3.length >= 3 && (
            <>
              {renderSilverCard(top3[1])}
              {renderGoldCard(top3[0])}
              {renderBronzeCard(top3[2])}
            </>
          )}
          {top3.length === 2 && (
            <>
              {renderGoldCard(top3[0])}
              {renderSilverCard(top3[1])}
            </>
          )}
          {top3.length === 1 && (
            <>
              {renderGoldCard(top3[0])}
            </>
          )}
        </div>
      )}

      {/* Filter and Search Panel */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Level Filter Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', gap: '3px', maxWidth: '100%' }}>
            {['All', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  background: tierFilter === t ? 'var(--bg-card)' : 'transparent',
                  color: tierFilter === t ? 'var(--text-main)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: tierFilter === t ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: tierFilter === t ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {t === 'All' ? 'All Tiers' : t === 'state_manager' ? 'State' : t === 'district_manager' ? 'District' : t === 'division_manager' ? 'Division' : 'Pincode'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 'min(100%, 240px)', maxWidth: '320px', flex: 1 }}>
            <input
              type="text"
              placeholder="Search manager or territory..."
              className="form-input"
              style={{ paddingLeft: '34px', height: '36px', fontSize: '0.82rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Full Rankings Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '8%', textAlign: 'center', paddingLeft: '18px' }}>Rank</th>
              <th style={{ width: '24%', textAlign: 'left' }}>Manager Profile</th>
              <th style={{ width: '18%', textAlign: 'left' }}>Hierarchy Tier</th>
              <th style={{ width: '20%', textAlign: 'left' }}>Territory Scope</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Total Vendors</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Active Verified</th>
              <th style={{ width: '10%', textAlign: 'center', paddingRight: '18px' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading real-time leaderboard rankings...
                </td>
              </tr>
            ) : filteredRankings.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No managers found matching criteria.
                </td>
              </tr>
            ) : (
              filteredRankings.map((m) => (
                <tr key={m.id} style={{ background: m.displayRank === 1 ? 'rgba(245, 158, 11, 0.08)' : m.isSelf ? 'rgba(234, 179, 8, 0.06)' : 'transparent' }}>
                  <td style={{ textAlign: 'center', paddingLeft: '18px' }}>
                    {getRankMedal(m.displayRank)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: m.avatarBg,
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {m.name.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {m.name} {m.isSelf && <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>★ You</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {m.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{getRoleBadge(m.role)}</td>
                  <td>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {m.territory}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{m.vendorsOnboarded}</strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                      {m.activeVendors} Active
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '18px' }}>
                    <span style={{
                      background: m.displayRank <= 3 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-subtle)',
                      color: m.displayRank <= 3 ? '#d97706' : 'var(--text-main)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>
                      {m.points.toLocaleString()} pts
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
