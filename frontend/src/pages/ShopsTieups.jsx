import React, { useState } from 'react';
import { ShoppingBag, Handshake, Store, Search, TrendingUp, CheckCircle2 } from 'lucide-react';

const ShopsTieups = ({ onNavigate }) => {
  const [search, setSearch] = useState('');

  const dummyTieups = [
    { id: 1, name: 'Fresh Mart Supermarket', type: 'Exclusive Tie-up', territory: 'Chennai Central', revenue: '₹ 1.8L / mo', status: 'Active', commission: '4.5%' },
    { id: 2, name: 'Ananda Dairy & Provisions', type: 'Regional Retailer', territory: 'Salem East', revenue: '₹ 95K / mo', status: 'Active', commission: '3.8%' },
    { id: 3, name: 'Apex Electronics Hub', type: 'Commercial Partner', territory: 'Krishnagiri North', revenue: '₹ 2.4L / mo', status: 'Active', commission: '5.0%' },
    { id: 4, name: 'Green Valley Organics', type: 'Direct Farm Tie-up', territory: 'Coimbatore West', revenue: '₹ 1.2L / mo', status: 'Active', commission: '4.0%' },
    { id: 5, name: 'Sri Balaji Textiles', type: 'Wholesale Partner', territory: 'Madurai City', revenue: '₹ 3.1L / mo', status: 'Active', commission: '6.2%' }
  ];

  const filtered = dummyTieups.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.territory.toLowerCase().includes(search.toLowerCase()));

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
          placeholder="Search shops, partner names, or territories..."
          className="form-input"
          style={{ maxWidth: '400px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Shop / Partner Name</th>
              <th>Partnership Model</th>
              <th>Territory</th>
              <th>Monthly Volume</th>
              <th>Revenue Share</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>
                  <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {item.type}
                  </span>
                </td>
                <td>{item.territory}</td>
                <td><strong>{item.revenue}</strong></td>
                <td>{item.commission}</td>
                <td>
                  <span className="status-badge active">
                    <span className="status-dot"></span> {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShopsTieups;
