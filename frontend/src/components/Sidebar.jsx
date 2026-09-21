import React, { useState } from 'react';
import { 
  Home, 
  Users, 
  BarChart2, 
  UserCheck, 
  UserPlus,
  Store, 
  ShoppingBag, 
  AlertTriangle, 
  TrendingUp, 
  Trophy,
  Bell, 
  User, 
  Settings, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ currentPage, onNavigate }) => {
  const { user } = useAuth();
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const isStateOrDistrict = user?.role === 'state_manager' || user?.role === 'district_manager' || user?.role === 'division_manager';

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

        {/* Reports > (Collapsible) */}
        <div>
          <div 
            className="sidebar-link"
            onClick={() => setReportsOpen(!reportsOpen)}
          >
            <div className="sidebar-link-left">
              <BarChart2 size={17} className="sidebar-link-icon" />
              <span>Reports</span>
            </div>
            {reportsOpen ? <ChevronDown size={14} className="sidebar-chevron" /> : <ChevronRight size={14} className="sidebar-chevron" />}
          </div>
          {reportsOpen && (
            <div className="sidebar-subnav">
              <div 
                className={`sidebar-sublink ${currentPage === 'reports' ? 'active' : ''}`}
                onClick={() => onNavigate('reports')}
              >
                Territory Analytics
              </div>
              <div 
                className={`sidebar-sublink ${currentPage === 'audit-logs' ? 'active' : ''}`}
                onClick={() => onNavigate('audit-logs')}
              >
                Audit Compliance
              </div>
            </div>
          )}
        </div>

        {/* Onboard Vendor */}
        <div 
          className={`sidebar-link ${currentPage === 'add-vendor' ? 'active' : ''}`}
          onClick={() => onNavigate('add-vendor')}
        >
          <div className="sidebar-link-left">
            <UserPlus size={17} className="sidebar-link-icon" />
            <span>Onboard Vendor</span>
          </div>
        </div>

        {/* Vendor Requests */}
        <div 
          className={`sidebar-link ${currentPage === 'vendor-requests' ? 'active' : ''}`}
          onClick={() => onNavigate('vendor-requests')}
        >
          <div className="sidebar-link-left">
            <UserCheck size={17} className="sidebar-link-icon" />
            <span>Vendor Requests</span>
          </div>
        </div>

        {/* Vendors */}
        <div 
          className={`sidebar-link ${currentPage === 'vendors' ? 'active' : ''}`}
          onClick={() => onNavigate('vendors')}
        >
          <div className="sidebar-link-left">
            <Store size={17} className="sidebar-link-icon" />
            <span>Vendors</span>
          </div>
        </div>

        {/* Issues */}
        <div 
          className={`sidebar-link ${currentPage === 'issues' ? 'active' : ''}`}
          onClick={() => onNavigate('issues')}
        >
          <div className="sidebar-link-left">
            <AlertTriangle size={17} className="sidebar-link-icon" />
            <span>Issues</span>
          </div>
        </div>

        {/* Performance */}
        <div 
          className={`sidebar-link ${currentPage === 'performance' ? 'active' : ''}`}
          onClick={() => onNavigate('performance')}
        >
          <div className="sidebar-link-left">
            <TrendingUp size={17} className="sidebar-link-icon" />
            <span>Performance</span>
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
