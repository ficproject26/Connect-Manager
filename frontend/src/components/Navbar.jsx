import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, LogOut, User, Settings, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

import { useRealtime } from '../realtime';

const Navbar = ({ onNavigate, onToggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
                width: 'min(420px, calc(100vw - 32px))',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 1000
              }}
            >
              <Search size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search managers, vendors, shops, pincodes, tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() && onNavigate) {
                    onNavigate('vendors', { search: searchQuery.trim() });
                    setSearchOpen(false);
                  }
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.84rem',
                  color: '#1e293b',
                  background: 'transparent'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
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
