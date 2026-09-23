import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, HelpCircle, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef(null);
  const profileDropdownRef = useRef(null);

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

  // Sync unread notification count & subscribe to real-time SSE
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('agent_mgr_token') || '';

    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications/unread-count', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success && isMounted) {
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (e) {
        // ignore network error
      }
    }

    fetchCount();

    try {
      const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'notification') {
            setUnreadCount(prev => prev + 1);
          }
        } catch (e) {}
      };
    } catch (err) {}

    const interval = setInterval(fetchCount, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (esRef.current) esRef.current.close();
    };
  }, [user]);

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
      {/* 1. Global Search Pill */}
      <div className="nav-search-box">
        <Search size={16} className="nav-search-icon" />
        <input
          type="text"
          placeholder="Search managers, vendors, shops, pincodes, tasks..."
          className="nav-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim() && onNavigate) {
              onNavigate('vendors', { search: searchQuery.trim() });
            }
          }}
        />
      </div>

      {/* 2. Top Nav Actions */}
      <div className="top-nav-actions">
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

        {/* Help Circle */}
        <button
          className="nav-icon-btn"
          title="Help and Support"
          onClick={() => alert('Forge India Connect Support Desk: support@forgeindiaconnect.in')}
        >
          <HelpCircle size={17} />
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
