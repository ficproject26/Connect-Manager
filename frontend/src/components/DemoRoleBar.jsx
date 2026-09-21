import React, { useState } from 'react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';

const DemoRoleBar = () => {
  const { user, quickSwitchRole, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside aria-label="Demo role selector" className="demo-role-floating-toggle">
      <button 
        className="demo-toggle-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Quick Role Switcher"
      >
        <Layers size={14} />
        <span>⚡ Demo Roles</span>
        {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {isOpen && (
        <div className="demo-toggle-panel">
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Switch Manager Jurisdiction
          </div>
          {DEMO_ACCOUNTS.map((acc) => {
            const isActive = user?.email === acc.email;
            return (
              <div
                key={acc.key}
                onClick={() => {
                  quickSwitchRole(acc.key);
                  setIsOpen(false);
                }}
                className={`demo-toggle-item ${isActive ? 'active' : ''}`}
              >
                <span>{acc.label}</span>
                {isActive && <span style={{ fontSize: '0.65rem' }}>● Active</span>}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};

export default DemoRoleBar;
