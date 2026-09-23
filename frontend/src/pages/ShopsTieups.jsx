import React, { useState, useEffect } from 'react';
import { ShoppingBag, Handshake, Store, Search, TrendingUp, CheckCircle2 } from 'lucide-react';
import { vendorService } from '../services/api';

const ShopsTieups = ({ onNavigate }) => {
  const [search, setSearch] = useState('');
  const [tieups, setTieups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTieups = async () => {
      try {
        setLoading(true);
        const res = await vendorService.getVendors({ status: 'Active' });
        if (res.success && Array.isArray(res.data)) {
          setTieups(res.data);
        } else {
          setTieups([]);
        }
      } catch (err) {
        console.error('Failed to load merchant tie-ups:', err);
        setTieups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTieups();
  }, []);

  const filtered = tieups.filter(t => 
    (t.businessName || t.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (t.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Shops & Merchant Tie-ups
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Strategic retail partnerships, outlet enrollments, and commercial merchant tie-ups in your territory
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('vendors')}>
          Explore Partner Network
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <input
          type="text"
          placeholder="Search shops, partner names, or categories..."
          className="form-input"
          style={{ maxWidth: '400px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-container">
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading merchant tie-ups...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Store size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
              No Active Merchant Tie-ups Found
            </div>
            <p style={{ fontSize: '0.82rem', maxWidth: '360px', margin: '0 auto' }}>
              When vendors are onboarded and verified as Active in your territory, their commercial tie-ups will appear here.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop / Partner Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item._id || item.id}>
                  <td>
                    <strong>{item.businessName || item.name}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {item.category || 'General'}
                    </span>
                  </td>
                  <td>{item.mobile || item.email || '-'}</td>
                  <td>
                    <span className="status-badge active">
                      <span className="status-dot"></span> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ShopsTieups;
