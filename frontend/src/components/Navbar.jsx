import React, { useState } from 'react';
import { Search, Bell, HelpCircle, ChevronDown, LogOut, User, Settings, Layers } from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';

const Navbar = ({ onNavigate }) => {
  const { user, logout, quickSwitchRole } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
          placeholder="Search managers, vendors, shops, pincodes, issues..."
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
        {/* Quick Demo Role Switcher Dropdown (Unobtrusive in Top Bar) */}
        <div style={{ position: 'relative' }}>
          <button
            className="nav-icon-btn"
            style={{ 
              width: 'auto', 
              padding: '0 10px', 
              gap: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              color: '#854d0e', 
              background: '#fef3c7', 
              borderColor: '#fde68a' 
            }}
            onClick={() => {
              setRoleMenuOpen(!roleMenuOpen);
              setDropdownOpen(false);
            }}
            title="Switch Manager Jurisdiction"
          >
            <Layers size={13} style={{ color: '#b45309' }} />
            <span>Switch Role</span>
            <ChevronDown size={12} />
          </button>

          {roleMenuOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '115%',
              width: '240px',
              background: 'white',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-normal)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              padding: '8px',
              zIndex: 50,
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '4px 8px' }}>
                Select Jurisdiction Tier
              </div>
              {DEMO_ACCOUNTS.map((acc) => {
                const isActive = user?.email === acc.email;
                return (
                  <div
                    key={acc.key}
                    onClick={() => {
                      quickSwitchRole(acc.key);
                      setRoleMenuOpen(false);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isActive ? '#fef08a' : 'transparent',
                      color: isActive ? '#854d0e' : '#334155',
                      fontWeight: isActive ? 700 : 500
                    }}
                  >
                    <span>{acc.label}</span>
                    {isActive && <span style={{ fontSize: '0.65rem', color: '#15803d' }}>● Current</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notification Bell with Badge 3 */}
        <button
          className="nav-icon-btn"
          title="Notifications"
          onClick={() => onNavigate && onNavigate('notifications')}
        >
          <Bell size={17} />
          <span className="nav-notification-badge">3</span>
        </button>

        {/* Help Circle */}
        <button
          className="nav-icon-btn"
          title="Help & Support"
          onClick={() => alert('Forge India Connect Support Desk: support@forgeindiaconnect.in')}
        >
          <HelpCircle size={17} />
        </button>

        {/* Manager User Profile Capsule */}
        <div style={{ position: 'relative' }}>
          <div 
            className="user-profile-btn"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setRoleMenuOpen(false);
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
