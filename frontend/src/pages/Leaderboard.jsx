import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/api';
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
  const [allRankings, setAllRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  const stateName = user?.scope?.stateName || user?.scope?.regionName || user?.state || '-';

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const res = await reportService.getLeaderboardData();
        if (res.success && res.data) {
          setAllRankings(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch live leaderboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [user]);

  const tierRankings = useMemo(() => {
    const list = allRankings.filter((m) => tierFilter === 'All' || m.role === tierFilter);
    return list.map((m, idx) => ({
      ...m,
      displayRank: tierFilter === 'All' ? m.rank : idx + 1
    }));
  }, [allRankings, tierFilter]);

  const filteredRankings = useMemo(() => {
    return tierRankings.filter((m) => {
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
    return tierRankings.slice(0, 3);
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
        return <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 1 • State Manager</span>;
      case 'district_manager':
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 2 • District Manager</span>;
      case 'division_manager':
        return <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 3 • Division Manager</span>;
      case 'pincode_manager':
        return <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Level 4 • Pincode Manager</span>;
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
          background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)', 
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
          <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {getTopLeaderBadgeText()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f59e0b', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#854d0e', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fde68a', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>SCORE</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>{card.points.toLocaleString()} pts</div>
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
          border: '1px solid #cbd5e1', 
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)', 
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
          <div style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🥈 2ND PLACE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#854d0e', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>SCORE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4f46e5' }}>{card.points.toLocaleString()} pts</div>
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
          border: '1px solid #fed7aa', 
          background: 'linear-gradient(to bottom, #ffffff, #fffaf5)', 
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
          <div style={{ display: 'inline-block', background: '#ffedd5', color: '#9a3412', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🥉 3RD PLACE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: card.avatarBg, color: 'white', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{card.name}</span>
                {card.isSelf && <span style={{ fontSize: '0.72rem', color: '#854d0e', fontWeight: 800 }}>★ You</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.territory}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fed7aa', paddingTop: '10px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>VENDORS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{card.vendorsOnboarded}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>ACTIVE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{card.activeVendors}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>SCORE</div>
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
            <span style={{ background: 'linear-gradient(135deg, #fef3c7, #fef08a)', color: '#854d0e', fontSize: '0.75rem', fontWeight: 800, padding: '3px 9px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Trophy size={13} color="#b45309" /> Live Database Rankings
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Real-time benchmarking of agent managers by live verified vendor accounts, KYC inspection velocity, and territory coverage.
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
          <button
            onClick={() => setPeriod('month')}
            style={{
              background: period === 'month' ? 'white' : 'transparent',
              color: period === 'month' ? 'var(--text-main)' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: period === 'month' ? 700 : 500,
              cursor: 'pointer',
              boxShadow: period === 'month' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            style={{
              background: period === 'quarter' ? 'white' : 'transparent',
              color: period === 'quarter' ? 'var(--text-main)' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: period === 'quarter' ? 700 : 500,
              cursor: 'pointer',
              boxShadow: period === 'quarter' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            This Quarter
          </button>
          <button
            onClick={() => setPeriod('year')}
            style={{
              background: period === 'year' ? 'white' : 'transparent',
              color: period === 'year' ? 'var(--text-main)' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: period === 'year' ? 700 : 500,
              cursor: 'pointer',
              boxShadow: period === 'year' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Full Year
          </button>
        </div>
      </div>

      {/* Top 3 Podium Showcase - Changes dynamically with State, District, Division, Pincode */}
      {top3.length > 0 && (
        <div 
          key={tierFilter}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: top3.length === 1 ? '1fr' : top3.length === 2 ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'repeat(auto-fit, minmax(280px, 1fr))', 
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
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
            {['All', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  background: tierFilter === t ? 'white' : 'transparent',
                  color: tierFilter === t ? 'var(--text-main)' : '#64748b',
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
          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '320px', flex: 1 }}>
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
                <tr key={m.id} style={{ background: m.displayRank === 1 ? '#fffbeb' : m.isSelf ? '#fefce8' : 'transparent' }}>
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
                          {m.name} {m.isSelf && <span style={{ fontSize: '0.7rem', color: '#854d0e', fontWeight: 800 }}>★ You</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {m.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{getRoleBadge(m.role)}</td>
                  <td>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      {m.territory}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{m.vendorsOnboarded}</strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                      {m.activeVendors} Active
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '18px' }}>
                    <span style={{
                      background: m.displayRank <= 3 ? '#fef3c7' : '#f1f5f9',
                      color: m.displayRank <= 3 ? '#92400e' : '#334155',
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
