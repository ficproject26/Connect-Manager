import React from 'react';
import { Bell, CheckCircle2, AlertTriangle, UserPlus, Info } from 'lucide-react';

const Notifications = () => {
  const notificationList = [
    { id: 1, title: 'New Merchant Onboarding Request: Sri Foods', desc: 'Category: Grocery & Food. Pincode: 635001. Awaiting manager approval.', time: '10:24 AM Today', type: 'request', unread: true },
    { id: 2, title: 'Compliance Notice: Bank Verification Updated', desc: 'IFSC lookup API service restored. All pending bank verifications can now be completed.', time: 'Yesterday 04:30 PM', type: 'info', unread: true },
    { id: 3, title: 'Monthly Territory Report Ready', desc: 'August 2026 performance summary is now downloadable from Scoped Reports.', time: '02 Sep 2026', type: 'alert', unread: true },
    { id: 4, title: 'System Maintenance Completed', desc: 'Database indexing completed successfully with zero downtime.', time: '01 Sep 2026', type: 'success', unread: false }
  ];

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Notifications & Alerts
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Field operation updates, merchant approvals, and system broadcast alerts
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '800px' }}>
        {notificationList.map((n) => (
          <div 
            key={n.id}
            className="card"
            style={{ 
              padding: '16px 20px', 
              marginBottom: 0,
              background: n.unread ? '#fffbeb' : 'white',
              border: n.unread ? '1px solid #fde68a' : '1px solid var(--border-normal)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: n.unread ? 'var(--forge-gold-vibrant)' : '#f1f5f9',
              color: n.unread ? '#713f12' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Bell size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{n.title}</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.time}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>{n.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
