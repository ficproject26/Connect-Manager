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
  Settings 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ currentPage, onNavigate }) => {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      {/* 1. Forge India Connect Header Branding */}
      <div className="sidebar-header">
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
          onClick={() => onNavigate('dashboard')}
        >
          <div className="sidebar-link-left">
            <Home size={17} className="sidebar-link-icon" />
            <span>Dashboard</span>
          </div>
        </div>
        {/* Managers Directory (Dedicated Separate Tab) */}
        <div 
          className={`sidebar-link ${currentPage === 'field-managers' ? 'active' : ''}`}
          onClick={() => onNavigate('field-managers')}
        >
          <div className="sidebar-link-left">
            <Users size={17} className="sidebar-link-icon" />
            <span>Managers Directory</span>
          </div>
        </div>

        {/* Agents Directory */}
        <div 
          className={`sidebar-link ${currentPage === 'agents-directory' || currentPage === 'agent-directory' ? 'active' : ''}`}
          onClick={() => onNavigate('agents-directory')}
        >
          <div className="sidebar-link-left">
            <UserCheck size={17} className="sidebar-link-icon" />
            <span>Agents Directory</span>
          </div>
        </div>

        {/* Vendors Directory */}
        <div 
          className={`sidebar-link ${currentPage === 'vendors' ? 'active' : ''}`}
          onClick={() => onNavigate('vendors')}
        >
          <div className="sidebar-link-left">
            <Store size={17} className="sidebar-link-icon" />
            <span>Vendors</span>
          </div>
        </div>

        {/* Reports (Single Module) */}
        <div 
          className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
          onClick={() => onNavigate('reports')}
        >
          <div className="sidebar-link-left">
            <BarChart2 size={17} className="sidebar-link-icon" />
            <span>Reports</span>
          </div>
        </div>



        {/* Tasks */}
        <div 
          className={`sidebar-link ${currentPage === 'tasks' || currentPage === 'issues' ? 'active' : ''}`}
          onClick={() => onNavigate('tasks')}
        >
          <div className="sidebar-link-left">
            <CheckSquare size={17} className="sidebar-link-icon" />
            <span>Tasks</span>
          </div>
        </div>

        {/* Leaderboard */}
        <div 
          className={`sidebar-link ${currentPage === 'leaderboard' ? 'active' : ''}`}
          onClick={() => onNavigate('leaderboard')}
        >
          <div className="sidebar-link-left">
            <Trophy size={17} className="sidebar-link-icon" />
            <span>Leaderboard</span>
          </div>
        </div>

        {/* Notifications */}
        <div 
          className={`sidebar-link ${currentPage === 'notifications' ? 'active' : ''}`}
          onClick={() => onNavigate('notifications')}
        >
          <div className="sidebar-link-left">
            <Bell size={17} className="sidebar-link-icon" />
            <span>Notifications</span>
          </div>
        </div>

        {/* Profile */}
        <div 
          className={`sidebar-link ${currentPage === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile')}
        >
          <div className="sidebar-link-left">
            <User size={17} className="sidebar-link-icon" />
            <span>Profile</span>
          </div>
        </div>

        {/* Settings */}
        <div 
          className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <div className="sidebar-link-left">
            <Settings size={17} className="sidebar-link-icon" />
            <span>Settings</span>
          </div>
        </div>
      </nav>

      {/* 3. Bottom Illustrated Footer Card */}
      <div className="sidebar-footer-card">
        <img 
          src="/assets/sidebar_footer.jpg" 
          alt="Stronger Communities" 
          className="sidebar-footer-img"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <div className="sidebar-footer-overlay">
          <div className="sidebar-footer-title">
            Stronger Businesses <br />
            Brighter Communities
          </div>
          <div className="sidebar-footer-meta">
            Forge India Connect <br />
            Manager Portal v1.0.0
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;