import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Store,
  ClipboardList,
  Check,
  Trash2,
  Search,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Notifications = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'vendor' | 'task' | 'unread'
  const [searchQuery, setSearchQuery] = useState('');
  const esRef = useRef(null);

  const token = localStorage.getItem('agent_mgr_token') || '';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch manager notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen to real-time events via SSE
    try {
      const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'notification' && parsed.data) {
            setNotifications(prev => [parsed.data, ...prev.filter(n => n._id !== parsed.data._id)]);
          }
        } catch (e) {}
      };
    } catch (err) {}

    return () => {
      if (esRef.current) esRef.current.close();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setNotifications(prev =>
        prev.map(n => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const removeNotification = async (id) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setNotifications(prev => prev.filter(n => n._id !== id && n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return 'Just now';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.isRead) return false;
    if (activeTab === 'vendor' && !(n.type?.startsWith('vendor') || n.entityType === 'vendor')) return false;
    if (activeTab === 'task' && !(n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMsg = n.message?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg) return false;
    }
    return true;
  });

  const unreadTotal = notifications.filter(n => !n.isRead).length;

  const handleClickItem = (n) => {
    markAsRead(n._id || n.id);
    if (onNavigate) {
      if (n.type?.startsWith('vendor') || n.entityType === 'vendor') {
        onNavigate('vendors');
      } else if (n.type?.startsWith('task') || n.entityType === 'task') {
        onNavigate('tasks');
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="var(--forge-gold-vibrant)" />
            Notifications & Alerts
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Real-time feed of merchant onboardings, compliance status updates, and field task assignments
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchNotifications}
            className="nav-icon-btn"
            title="Refresh"
            style={{ borderRadius: '8px', padding: '8px 12px', background: 'white', border: '1px solid var(--border-normal)' }}
          >
            <RefreshCw size={15} />
          </button>
          {unreadTotal > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: '8px 14px',
                background: 'var(--forge-gold-vibrant)',
                color: '#713f12',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={15} /> Mark All as Read ({unreadTotal})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px', maxWidth: '850px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread (${unreadTotal})` },
            { id: 'vendor', label: 'Vendors' },
            { id: 'task', label: 'Tasks' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: activeTab === t.id ? '1px solid var(--forge-gold-vibrant)' : '1px solid var(--border-normal)',
                background: activeTab === t.id ? '#fffbeb' : 'white',
                color: activeTab === t.id ? '#713f12' : '#64748b'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              fontSize: '0.78rem',
              borderRadius: '16px',
              border: '1px solid var(--border-normal)',
              outline: 'none',
              background: 'white'
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '850px' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            Loading live notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid var(--border-normal)' }}>
            <Bell size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#475569' }}>No notifications found</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
              Real-time alerts for vendor onboarding and tasks will appear here as they occur.
            </div>
          </div>
        ) : (
          filtered.map((n) => {
            const notifId = n._id || n.id;
            const isVendor = n.type?.startsWith('vendor') || n.entityType === 'vendor';
            const isTask = n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task';

            return (
              <div 
                key={notifId}
                className="card"
                onClick={() => handleClickItem(n)}
                style={{ 
                  padding: '16px 20px', 
                  marginBottom: 0,
                  background: !n.isRead ? '#fffbeb' : 'white',
                  border: !n.isRead ? '1px solid #fde68a' : '1px solid var(--border-normal)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: !n.isRead ? 'var(--forge-gold-vibrant)' : '#f1f5f9',
                  color: !n.isRead ? '#713f12' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isVendor ? <Store size={18} /> : isTask ? <ClipboardList size={18} /> : <Bell size={18} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{n.title}</strong>
                      {!n.isRead && (
                        <span style={{ fontSize: '10px', background: '#f59e0b', color: '#0f172a', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{getRelativeTime(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                    {n.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {n.scope?.pincode ? `PIN: ${n.scope.pincode}` : n.scope?.district || 'General'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => removeNotification(notifId)}
                        title="Dismiss"
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => handleClickItem(n)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#b45309',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        Open <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notifications;
