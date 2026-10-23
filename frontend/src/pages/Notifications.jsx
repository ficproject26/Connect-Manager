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
  RefreshCw,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';
import { useRealtime } from '../realtime';

const Notifications = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'vendor' | 'task' | 'unread'
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem('agent_mgr_token') || '';


  const broadcastUnreadCount = (count) => {
    const safeCount = Math.max(0, count);
    window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { unreadCount: safeCount, safeCount, count: safeCount } }));
    window.dispatchEvent(new CustomEvent('unread-count-updated', { detail: { unreadCount: safeCount, safeCount, count: safeCount } }));
  };

  const fetchNotifications = async () => {
    if (!token || token.startsWith('mock_token_')) {
      setNotifications([]);
      broadcastUnreadCount(0);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setNotifications([]);
        broadcastUnreadCount(0);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        const unread = data.notifications.filter(n => !n.isRead).length;
        broadcastUnreadCount(unread);
      } else {
        setNotifications([]);
        broadcastUnreadCount(0);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
      setNotifications([]);
      broadcastUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Real-time synchronization
  useRealtime('notification', (ev) => {
    if (ev.action === 'created' && ev.data) {
      setNotifications(prev => {
        const nextList = [ev.data, ...prev.filter(n => (n._id || n.id) !== (ev.data._id || ev.data.id))];
        broadcastUnreadCount(nextList.filter(n => !n.isRead).length);
        return nextList;
      });
    } else if (ev.action === 'updated' && ev.data) {
      setNotifications(prev => {
        const nextList = prev.map(n => ((n._id || n.id) === (ev.data._id || ev.data.id) ? { ...n, ...ev.data } : n));
        broadcastUnreadCount(nextList.filter(n => !n.isRead).length);
        return nextList;
      });
    } else if (ev.action === 'deleted') {
      const delId = String(ev.entityId);
      setNotifications(prev => {
        const nextList = prev.filter(n => String(n._id || n.id) !== delId);
        broadcastUnreadCount(nextList.filter(n => !n.isRead).length);
        return nextList;
      });
    }
  });

  const markAsRead = async (id) => {
    const target = notifications.find(n => (n._id === id || n.id === id));
    if (!target || target.isRead) {
      return; // Prevent duplicate requests
    }

    const previousNotifications = notifications;
    const updated = notifications.map(n => (n._id === id || n.id === id ? { ...n, isRead: true } : n));
    setNotifications(updated);
    const remainingUnread = updated.filter(n => !n.isRead).length;
    broadcastUnreadCount(remainingUnread);

    try {
      if (token && !token.startsWith('mock_token_')) {
        const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to update read state on server');
      }
    } catch (err) {
      console.error('Mark as read error:', err);
      setNotifications(previousNotifications);
      broadcastUnreadCount(previousNotifications.filter(n => !n.isRead).length);
    }
  };

  const markAllAsRead = async () => {
    const unreadCountBefore = notifications.filter(n => !n.isRead).length;
    if (unreadCountBefore === 0) return;

    const previousNotifications = notifications;
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    broadcastUnreadCount(0);

    try {
      if (token && !token.startsWith('mock_token_')) {
        const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to mark all as read on server');
      }
    } catch (err) {
      console.error('Mark all as read error:', err);
      setNotifications(previousNotifications);
      broadcastUnreadCount(unreadCountBefore);
    }
  };

  const removeNotification = async (id) => {
    const previousNotifications = notifications;
    const updated = notifications.filter(n => n._id !== id && n.id !== id);
    setNotifications(updated);
    broadcastUnreadCount(updated.filter(n => !n.isRead).length);

    try {
      if (token && !token.startsWith('mock_token_')) {
        const res = await fetch(`${API_BASE}/notifications/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Delete notification error:', err);
      setNotifications(previousNotifications);
      broadcastUnreadCount(previousNotifications.filter(n => !n.isRead).length);
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

  const userState = String(user?.state || user?.stateName || user?.scope?.stateName || '').toLowerCase();
  const userStateId = String(user?.stateId || user?.scope?.stateId || '').toLowerCase();
  const isKaUser = userState.includes('karnataka') || userStateId === 'state_ka';
  const isTnUser = userState.includes('tamil nadu') || userStateId === 'state_tn' || userStateId === '6aa10f70ca0932e6eaec1f5c';

  const tnLocations = [
    'tamil nadu', 'kallakurichi', 'salem', 'dharmapuri', 'chennai', 'krishnagiri',
    'hosur', 'coimbatore', 'madurai', 'tiruchirappalli', 'trichy', 'vellore',
    'erode', 'tirupur', 'thanjavur', 'dindigul', 'tirunelveli', 'thoothukudi'
  ];
  const kaLocations = [
    'karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubli', 'dharwad',
    'mangalore', 'mangaluru', 'belgaum', 'belagavi', 'gulbarga', 'kalaburagi'
  ];

  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.isRead) return false;
    if (activeTab === 'vendor' && !(n.type?.startsWith('vendor') || n.entityType === 'vendor')) return false;
    if (activeTab === 'task' && !(n.type?.startsWith('task') || n.type?.startsWith('qc') || n.entityType === 'task')) return false;

    // Cross-state isolation
    const txt = `${n.title || ''} ${n.message || ''} ${n.details || ''}`.toLowerCase();
    if (isKaUser && tnLocations.some(loc => txt.includes(loc))) return false;
    if (isTnUser && kaLocations.some(loc => txt.includes(loc))) return false;

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
    <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '22px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Bell size={24} color="var(--forge-gold-vibrant)" />
            Notifications & Alerts
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Real-time feed of merchant onboardings, compliance status updates, and field task assignments
          </p>
        </div>

        <div>
          {unreadTotal > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              style={{
                height: '40px',
                padding: '0 16px',
                background: 'var(--forge-gold-vibrant)',
                color: '#713f12',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 1px 3px rgba(245, 158, 11, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <Check size={16} /> Mark All as Read ({unreadTotal})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs, Search Bar & Refresh Button Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '20px',
        width: '100%',
        flexWrap: 'wrap'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                height: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: activeTab === t.id ? 700 : 600,
                cursor: 'pointer',
                border: activeTab === t.id ? '1.5px solid var(--forge-gold-vibrant)' : '1px solid var(--border-normal)',
                background: activeTab === t.id ? '#fffbeb' : '#ffffff',
                color: activeTab === t.id ? '#713f12' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: activeTab === t.id ? '0 1px 3px rgba(245, 158, 11, 0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Bar + Refresh Button Group */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: '1 1 360px',
          maxWidth: '520px',
          justifyContent: 'flex-end',
          minWidth: '280px'
        }}>
          {/* Enhanced Search Bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 36px 0 38px',
                fontSize: '0.86rem',
                borderRadius: '8px',
                border: '1px solid var(--border-normal)',
                outline: 'none',
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--forge-gold-vibrant)';
                e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-normal)';
                e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear alert search"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '50%'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Refresh Button Aligned With Search */}
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={loading}
            title="Refresh notifications"
            aria-label="Refresh notifications"
            style={{
              height: '40px',
              padding: '0 16px',
              background: '#ffffff',
              border: '1px solid var(--border-normal)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.84rem',
              color: 'var(--text-main)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
              style={{ color: 'var(--primary)' }}
            />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flex: 1 }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            Loading live notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '70px 24px',
            minHeight: '380px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            borderRadius: '14px',
            border: '1px solid var(--border-normal)',
            boxShadow: 'var(--shadow-card)',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <Bell size={28} style={{ color: '#94a3b8' }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#334155' }}>No notifications found</div>
            <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '6px', maxWidth: '440px', lineHeight: 1.5 }}>
              Real-time alerts for vendor onboarding, compliance status updates, and field task assignments will appear here as they occur.
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
                        type="button"
                        onClick={() => handleClickItem(n)}
                        style={{
                          background: '#fef3c7',
                          border: '1px solid #fde68a',
                          color: '#b45309',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fde68a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fef3c7'; }}
                      >
                        Open <ArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNotification(notifId)}
                        title="Delete notification"
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                      >
                        <Trash2 size={13} /> Delete
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
