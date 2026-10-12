import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, ChevronDown, LogOut, User, Settings, Menu, X,
  Store, CheckSquare, MapPin, Loader, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  vendorService, managerService, taskService, shopVisitService, API_BASE 
} from '../services/api';
import { getDisplayValue } from '../utils/normalize';
import { useRealtime } from '../realtime';

const Navbar = ({ onNavigate, onToggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ vendors: [], managers: [], tasks: [], shops: [] });
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileDropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on outside touch or click anywhere on screen
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [dropdownOpen]);

  // Search popover focus and outside-click / ESC close listener
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleSearchOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    const handleSearchKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    if (searchOpen) {
      document.addEventListener('mousedown', handleSearchOutsideClick);
      document.addEventListener('touchstart', handleSearchOutsideClick);
      document.addEventListener('keydown', handleSearchKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleSearchOutsideClick);
      document.removeEventListener('touchstart', handleSearchOutsideClick);
      document.removeEventListener('keydown', handleSearchKeyDown);
    };
  }, [searchOpen]);

  // Debounced multi-entity search effect (Managers, Vendors, Shops, Pincodes, Tasks)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults({ vendors: [], managers: [], tasks: [], shops: [] });
      setHasSearched(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const qLower = q.toLowerCase();
        const [vRes, mRes, tRes, sRes] = await Promise.allSettled([
          vendorService.getVendors({ search: q, limit: 6 }),
          managerService.getManagerDirectory({}, user),
          taskService.getTasks({}, user),
          shopVisitService.getShopVisits({ search: q, limit: 6 })
        ]);

        const matchedVendors = (vRes.status === 'fulfilled' && vRes.value?.success && Array.isArray(vRes.value?.data))
          ? vRes.value.data.slice(0, 6)
          : [];

        let matchedManagers = [];
        if (mRes.status === 'fulfilled' && mRes.value?.success) {
          const allMgrs = Array.isArray(mRes.value?.all) ? mRes.value.all : (Array.isArray(mRes.value?.data) ? mRes.value.data : []);
          matchedManagers = allMgrs.filter(m => {
            const name = String(m?.name || '').toLowerCase();
            const email = String(m?.email || '').toLowerCase();
            const phone = String(m?.phone || m?.mobile || '').toLowerCase();
            const pin = String(m?.pincodeCode || m?.pincode || '').toLowerCase();
            const dist = String(m?.districtName || m?.district || '').toLowerCase();
            const id = String(m?.managerId || m?._id || '').toLowerCase();
            const role = String(m?.role || '').toLowerCase();
            return name.includes(qLower) || email.includes(qLower) || phone.includes(qLower) || pin.includes(qLower) || dist.includes(qLower) || id.includes(qLower) || role.includes(qLower);
          }).slice(0, 6);
        }

        let matchedTasks = [];
        if (tRes.status === 'fulfilled' && tRes.value?.success) {
          const allTasks = Array.isArray(tRes.value?.tasks) ? tRes.value.tasks : (Array.isArray(tRes.value?.data) ? tRes.value.data : []);
          matchedTasks = allTasks.filter(t => {
            const title = String(t?.title || '').toLowerCase();
            const desc = String(t?.description || '').toLowerCase();
            const vName = String(t?.vendorName || '').toLowerCase();
            const type = String(t?.type || '').toLowerCase();
            const id = String(t?.taskId || t?._id || '').toLowerCase();
            return title.includes(qLower) || desc.includes(qLower) || vName.includes(qLower) || type.includes(qLower) || id.includes(qLower);
          }).slice(0, 6);
        }

        let matchedShops = [];
        if (sRes.status === 'fulfilled' && sRes.value?.success) {
          const allVisits = Array.isArray(sRes.value?.visits) ? sRes.value.visits : (Array.isArray(sRes.value?.data) ? sRes.value.data : []);
          matchedShops = allVisits.filter(s => {
            const shopName = String(s?.shopName || '').toLowerCase();
            const cat = String(s?.category || '').toLowerCase();
            const pin = String(s?.pincodeCode || '').toLowerCase();
            const mgr = String(s?.managerName || '').toLowerCase();
            return shopName.includes(qLower) || cat.includes(qLower) || pin.includes(qLower) || mgr.includes(qLower);
          }).slice(0, 6);
        }

        setSearchResults({
          vendors: matchedVendors,
          managers: matchedManagers,
          tasks: matchedTasks,
          shops: matchedShops
        });
        setHasSearched(true);
      } catch (err) {
        console.warn('[GlobalSearch] search query error:', err);
        setSearchResults({ vendors: [], managers: [], tasks: [], shops: [] });
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const totalResultsCount = searchResults.vendors.length + searchResults.managers.length + searchResults.tasks.length + searchResults.shops.length;

  const handleSelectVendor = (v) => {
    setSearchOpen(false);
    if (onNavigate) onNavigate('vendor-details', { vendorId: v._id || v.id });
  };

  const handleSelectManager = (m) => {
    setSearchOpen(false);
    if (onNavigate) onNavigate('field-managers', { search: m.name });
  };

  const handleSelectTask = (t) => {
    setSearchOpen(false);
    if (onNavigate) onNavigate('tasks', { search: t.title || t._id });
  };

  const handleSelectShop = (s) => {
    setSearchOpen(false);
    if (onNavigate) onNavigate('reports', { tab: 'visits', search: s.shopName });
  };

  const handleSearchInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (totalResultsCount > 0) {
        if (searchResults.vendors.length > 0) {
          handleSelectVendor(searchResults.vendors[0]);
        } else if (searchResults.managers.length > 0) {
          handleSelectManager(searchResults.managers[0]);
        } else if (searchResults.tasks.length > 0) {
          handleSelectTask(searchResults.tasks[0]);
        } else if (searchResults.shops.length > 0) {
          handleSelectShop(searchResults.shops[0]);
        }
      }
      // If totalResultsCount === 0: do NOT redirect to vendors! Keep the no-results message visible.
    }
  };

  // Sync unread notification count
  const fetchCount = async () => {
    const token = localStorage.getItem('agent_mgr_token') || '';
    if (!token || token.startsWith('mock_token_')) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCount();
  }, []);

  // Real-time synchronization for notifications
  useRealtime('notification', (ev) => {
    if (ev.action === 'created') {
      setUnreadCount(prev => prev + 1);
    } else {
      fetchCount();
    }
  });

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'state_manager': return 'State Manager';
      case 'district_manager': return 'District Manager';
      case 'division_manager': return 'Division Manager';
      case 'pincode_manager': return 'Pincode Manager';
      default: return 'State Manager';
    }
  };

  const displayName = user?.name || 'Ramesh Kumar';
  const displayRole = user?.role ? getRoleDisplayName(user.role) : 'State Manager';

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileSidebar}
          title="Open navigation menu"
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Top Nav Actions */}
      <div className="top-nav-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Search Icon & Popover */}
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="nav-icon-btn"
            title="Search"
            aria-label="Search"
            onClick={() => setSearchOpen(prev => !prev)}
            style={{
              background: searchOpen ? 'rgba(2, 132, 199, 0.1)' : undefined,
              color: searchOpen ? '#0284c7' : undefined
            }}
          >
            <Search size={17} />
          </button>

          {searchOpen && (
            <div
              className="search-popover-panel"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: 'min(480px, calc(100vw - 32px))',
                background: '#ffffff',
                borderRadius: '14px',
                border: '1.5px solid #cbd5e1',
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000,
                overflow: 'hidden'
              }}
            >
              {/* Input Header Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: '#ffffff'
              }}>
                <Search size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search managers, vendors, shops, pincodes, tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchInputKeyDown}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.86rem',
                    color: '#1e293b',
                    background: 'transparent'
                  }}
                />
                {searching && (
                  <Loader size={15} className="animate-spin" style={{ color: '#0284c7', flexShrink: 0 }} />
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults({ vendors: [], managers: [], tasks: [], shops: [] });
                      setHasSearched(false);
                    }}
                    title="Clear search query"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  title="Close (Esc)"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span>Esc</span>
                </button>
              </div>

              {/* Search Results Dropdown Body */}
              {searchQuery.trim().length >= 2 && (
                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  maxHeight: '380px',
                  overflowY: 'auto'
                }}>
                  {searching && totalResultsCount === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                      <Loader size={18} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 8px' }} />
                      <div>Searching across managers, vendors, shops, pincodes, tasks...</div>
                    </div>
                  ) : hasSearched && totalResultsCount === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                      <Search size={28} style={{ color: '#cbd5e1', margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b' }}>
                        No matching records found
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 4, maxWidth: 340, margin: '4px auto 0' }}>
                        No managers, vendors, shops, pincodes, or tasks matched "{searchQuery}" within your assigned territory.
                      </div>
                    </div>
                  ) : totalResultsCount > 0 ? (
                    <div style={{ padding: '8px 0' }}>
                      {/* 1. Vendors Section */}
                      {searchResults.vendors.length > 0 && (
                        <div>
                          <div style={{
                            padding: '6px 14px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            color: '#0284c7',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <Store size={12} /> Vendors ({searchResults.vendors.length})
                          </div>
                          {searchResults.vendors.map(v => (
                            <div
                              key={v._id || v.id}
                              onClick={() => handleSelectVendor(v)}
                              style={{
                                padding: '8px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: '#ffffff',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  {v.businessName || v.name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                  <span>{v.name}</span>
                                  {v.mobile && <span>• +91 {v.mobile}</span>}
                                  {v.pincodeCode && (
                                    <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontWeight: 700, color: '#334155' }}>
                                      PIN {v.pincodeCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 12,
                                  background: v.status === 'Active' ? '#d1fae5' : '#fef3c7',
                                  color: v.status === 'Active' ? '#047857' : '#b45309'
                                }}>
                                  {v.status || 'Active'}
                                </span>
                                <ArrowRight size={13} style={{ color: '#94a3b8' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 2. Managers Section */}
                      {searchResults.managers.length > 0 && (
                        <div style={{ marginTop: searchResults.vendors.length > 0 ? 8 : 0 }}>
                          <div style={{
                            padding: '6px 14px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            color: '#7c3aed',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <User size={12} /> Managers ({searchResults.managers.length})
                          </div>
                          {searchResults.managers.map(m => (
                            <div
                              key={m._id || m.id || m.managerId}
                              onClick={() => handleSelectManager(m)}
                              style={{
                                padding: '8px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: '#ffffff',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#faf5ff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  {m.name || 'Manager'}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                  <span>{getDisplayValue(m.roleLabel || m.role, 'Field Manager')}</span>
                                  {m.phone && <span>• +91 {m.phone}</span>}
                                  {m.pincodeCode && (
                                    <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontWeight: 700, color: '#334155' }}>
                                      PIN {m.pincodeCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ArrowRight size={13} style={{ color: '#94a3b8' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 3. Tasks Section */}
                      {searchResults.tasks.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{
                            padding: '6px 14px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            color: '#ea580c',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <CheckSquare size={12} /> Tasks ({searchResults.tasks.length})
                          </div>
                          {searchResults.tasks.map(t => (
                            <div
                              key={t._id || t.id}
                              onClick={() => handleSelectTask(t)}
                              style={{
                                padding: '8px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: '#ffffff',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fff7ed'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  {t.title || 'QC Task'}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                  <span>{t.type || 'Field Task'}</span>
                                  {t.vendorName && <span>• {t.vendorName}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 12,
                                  background: t.status === 'Completed' ? '#d1fae5' : '#fee2e2',
                                  color: t.status === 'Completed' ? '#047857' : '#b91c1c'
                                }}>
                                  {t.status || 'Pending'}
                                </span>
                                <ArrowRight size={13} style={{ color: '#94a3b8' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 4. Shops / Visits Section */}
                      {searchResults.shops.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{
                            padding: '6px 14px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            color: '#059669',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            <MapPin size={12} /> Shops & Visits ({searchResults.shops.length})
                          </div>
                          {searchResults.shops.map(s => (
                            <div
                              key={s._id || s.id}
                              onClick={() => handleSelectShop(s)}
                              style={{
                                padding: '8px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: '#ffffff',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  {s.shopName || 'Shop Visit'}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                  <span>{s.category || 'Products'}</span>
                                  {s.managerName && <span>• {s.managerName}</span>}
                                  {s.pincodeCode && (
                                    <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontWeight: 700, color: '#334155' }}>
                                      PIN {s.pincodeCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 12,
                                  background: s.interestedStatus === 'YES' ? '#d1fae5' : '#fee2e2',
                                  color: s.interestedStatus === 'YES' ? '#047857' : '#b91c1c'
                                }}>
                                  {s.interestedStatus === 'YES' ? 'Interested' : 'Not Interested'}
                                </span>
                                <ArrowRight size={13} style={{ color: '#94a3b8' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notification Bell with Dynamic Badge */}
        <button
          className="nav-icon-btn"
          title="Notifications"
          onClick={() => {
            if (onNavigate) {
              onNavigate('notifications');
            }
          }}
          style={{ position: 'relative' }}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span
              className="nav-notification-badge"
              style={{
                background: '#ef4444',
                color: 'white',
                fontWeight: 800,
                fontSize: '10px'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Manager User Profile Capsule */}
        <div ref={profileDropdownRef} style={{ position: 'relative' }}>
          <div 
            className="user-profile-btn"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <div className="user-avatar-circle">
              <img 
                src={user?.avatarUrl || "/assets/ramesh_kumar.jpg"} 
                alt={displayName} 
                className="user-avatar-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerText = displayName.slice(0, 2).toUpperCase();
                }}
              />
              <span className="user-online-dot"></span>
            </div>
            <div className="user-profile-info">
              <div className="user-profile-name">{displayName}</div>
              <div className="user-profile-role">{displayRole}</div>
            </div>
            <ChevronDown size={14} style={{ color: '#64748b' }} />
          </div>

          {/* User Dropdown Menu */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '115%',
              width: '190px',
              background: 'white',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-normal)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              padding: '6px',
              zIndex: 50
            }}>
              <div 
                style={{
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  color: '#334155'
                }}
                onClick={() => {
                  setDropdownOpen(false);
                  onNavigate && onNavigate('profile');
                }}
              >
                <User size={14} /> My Profile
              </div>
              <div 
                style={{
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  color: '#334155'
                }}
                onClick={() => {
                  setDropdownOpen(false);
                  onNavigate && onNavigate('settings');
                }}
              >
                <Settings size={14} /> Settings
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
              <div 
                style={{
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  color: '#dc2626'
                }}
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
              >
                <LogOut size={14} /> Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
