import React from 'react';
import { 
  Home, 
  Users, 
  UserCheck, 
  BarChart2, 
  Store, 
  CheckSquare, 
  Trophy, 
  Bell, 
  User, 
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ currentPage, onNavigate, mobileOpen, onCloseMobile }) => {
  const { user } = useAuth();

  const handleNav = (page) => {
    onNavigate(page);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div 
          className="sidebar-backdrop mobile-open" 
          onClick={onCloseMobile} 
          aria-hidden="true" 
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* 1. Forge India Connect Header Branding */}
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onCloseMobile}
            title="Close menu"
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
          <img 
            src="/assets/sidebar_header_arch.png" 
            alt="Forge India Connect" 
            className="sidebar-header-banner-img" 
          />
          <div className="sidebar-brand-subtitle">
            Let's Connect!
          </div>
        </div>

        {/* 2. Navigation Menu */}
        <nav className="sidebar-nav">
          {/* Dashboard (Active Yellow Capsule) */}
          <div 
            className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('dashboard')}
          >
            <div className="sidebar-link-left">
              <Home size={17} className="sidebar-link-icon" />
              <span>Dashboard</span>
            </div>
          </div>

          {/* Managers Directory */}
          <div 
            className={`sidebar-link ${currentPage === 'field-managers' ? 'active' : ''}`}
            onClick={() => handleNav('field-managers')}
          >
            <div className="sidebar-link-left">
              <Users size={17} className="sidebar-link-icon" />
              <span>Managers Directory</span>
            </div>
          </div>

          {/* Agents Directory */}
          <div 
            className={`sidebar-link ${currentPage === 'agents-directory' || currentPage === 'agent-directory' ? 'active' : ''}`}
            onClick={() => handleNav('agents-directory')}
          >
            <div className="sidebar-link-left">
              <UserCheck size={17} className="sidebar-link-icon" />
              <span>Agents Directory</span>
            </div>
          </div>

          {/* Vendors Directory */}
          <div 
            className={`sidebar-link ${currentPage === 'vendors' ? 'active' : ''}`}
            onClick={() => handleNav('vendors')}
          >
            <div className="sidebar-link-left">
              <Store size={17} className="sidebar-link-icon" />
              <span>Vendors</span>
            </div>
          </div>

          {/* Reports */}
          <div 
            className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
            onClick={() => handleNav('reports')}
          >
            <div className="sidebar-link-left">
              <BarChart2 size={17} className="sidebar-link-icon" />
              <span>Reports</span>
            </div>
          </div>

          {/* Tasks */}
          <div 
            className={`sidebar-link ${currentPage === 'tasks' || currentPage === 'issues' ? 'active' : ''}`}
            onClick={() => handleNav('tasks')}
          >
            <div className="sidebar-link-left">
              <CheckSquare size={17} className="sidebar-link-icon" />
              <span>Tasks</span>
            </div>
          </div>

          {/* Leaderboard */}
          <div 
            className={`sidebar-link ${currentPage === 'leaderboard' ? 'active' : ''}`}
            onClick={() => handleNav('leaderboard')}
          >
            <div className="sidebar-link-left">
              <Trophy size={17} className="sidebar-link-icon" />
              <span>Leaderboard</span>
            </div>
          </div>

          {/* Notifications */}
          <div 
            className={`sidebar-link ${currentPage === 'notifications' ? 'active' : ''}`}
            onClick={() => handleNav('notifications')}
          >
            <div className="sidebar-link-left">
              <Bell size={17} className="sidebar-link-icon" />
              <span>Notifications</span>
            </div>
          </div>

          {/* Profile */}
          <div 
            className={`sidebar-link ${currentPage === 'profile' ? 'active' : ''}`}
            onClick={() => handleNav('profile')}
          >
            <div className="sidebar-link-left">
              <User size={17} className="sidebar-link-icon" />
              <span>Profile</span>
            </div>
          </div>

          {/* Settings */}
          <div 
            className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => handleNav('settings')}
          >
            <div className="sidebar-link-left">
              <Settings size={17} className="sidebar-link-icon" />
              <span>Settings</span>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;