import React, { useState, useEffect } from 'react';
import { vendorService, locationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  PlusCircle, 
  Eye, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Store
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const CATEGORIES = [
  'All',
  'Services',
  'Products',
  'Daily Needs',
  'Food',
  'Stay',
  'Travel',
  'Jobs'
];

const STATUSES = ['All', 'Active', 'Pending', 'Under Review', 'Rejected', 'Inactive'];

const Vendors = ({ onNavigate, filterParams = {}, onOpenOnboard }) => {
  const { user } = useAuth();

  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [districtId, setDistrictId] = useState(filterParams.districtId || '');
  const [divisionId, setDivisionId] = useState(filterParams.divisionId || '');
  const [pincodeId, setPincodeId] = useState(filterParams.pincodeId || '');

  // Dynamic dropdown options for scope filtering
  const [districts, setDistricts] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [pincodes, setPincodes] = useState([]);

  useEffect(() => {
    const loadScopeOptions = async () => {
      try {
        if (user?.role === 'state_manager') {
          const res = await locationService.getDistricts();
          if (res.success) setDistricts(res.data);
        }
        if (user?.districtId || user?.role === 'district_manager') {
          const res = await locationService.getDivisions(user?.districtId);
          if (res.success) setDivisions(res.data);
        }
        if (user?.divisionId || user?.role === 'division_manager') {
          const res = await locationService.getPincodes(user?.divisionId);
          if (res.success) setPincodes(res.data);
        }
      } catch (err) {
        console.error('Failed to load filter location options:', err);
      }
    };
    loadScopeOptions();
  }, [user]);

  const loadVendors = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        search: search.trim() || undefined,
        category: category !== 'All' ? category : undefined,
        status: status !== 'All' ? status : undefined,
        districtId: districtId || undefined,
        divisionId: divisionId || undefined,
        pincodeId: pincodeId || undefined
      };
      const res = await vendorService.getVendors(params);
      if (res.success) {
        setVendors(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors(1);
  }, [search, category, status, districtId, divisionId, pincodeId]);

  const resetFilters = () => {
    setSearch('');
    setCategory('All');
    setStatus('All');
    setDistrictId('');
    setDivisionId('');
    setPincodeId('');
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Vendor Directory</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Managing vendors geographically scoped to your jurisdiction ({pagination.total} total)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onOpenOnboard ? onOpenOnboard() : onNavigate('add-vendor')}>
          <PlusCircle size={18} /> Register New Vendor
        </button>
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search name, biz, mobile..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>

          {/* Category Filter */}
          <div>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
              ))}
            </select>
          </div>

          {/* Scope Filters (if State/District manager) */}
          {user?.role === 'state_manager' && districts.length > 0 && (
            <div>
              <select
                className="form-select"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters */}
          <div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', height: '40px' }}
              onClick={resetFilters}
            >
              <RotateCcw size={14} /> Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '5%', textAlign: 'center', paddingLeft: '16px' }}>S.No</th>
              <th style={{ width: '24%', textAlign: 'left', paddingLeft: '12px' }}>Business & Contact</th>
              <th style={{ width: '17%', textAlign: 'left' }}>Category</th>
              <th style={{ width: '21%', textAlign: 'left' }}>Location Scope</th>
              <th style={{ width: '16%', textAlign: 'left' }}>Masked Identifiers</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Status</th>
              <th style={{ width: '9%', textAlign: 'center', paddingRight: '20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading vendors within your scope...
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <Store size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1', display: 'block' }} />
                  <div>No vendors found matching your current scope & filters.</div>
                </td>
              </tr>
            ) : (
              vendors.map((v, index) => (
                <tr key={v._id}>
                  <td style={{ textAlign: 'center', paddingLeft: '16px', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>
                    {(pagination?.page ? (pagination.page - 1) * (pagination.limit || 10) : 0) + index + 1}
                  </td>
                  <td style={{ paddingLeft: '12px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                      {v.businessName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{v.name}</span>
                      <span>•</span>
                      <span>+91 {v.mobile}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                      {v.category}
                    </div>
                    {v.subCategory ? (
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        {v.subCategory}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>General</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.75rem', fontWeight: 700 }}>
                        PIN {v.pincodeCode}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      {[v.divisionName, v.districtName].filter(Boolean).join(' • ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>PAN:</span>
                      <code style={{ background: '#f8fafc', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '0.74rem', fontFamily: 'monospace', color: '#334155' }}>
                        {v.panNumber || 'N/A'}
                      </code>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>A/C:</span>
                      <code style={{ background: '#f8fafc', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '0.74rem', fontFamily: 'monospace', color: '#334155' }}>
                        {v.accountNumber || 'N/A'}
                      </code>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge status={v.status} />
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        title="View Details"
                        onClick={() => onNavigate('vendor-details', { vendorId: v._id })}
                        style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 600 }}
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Edit Details"
                        onClick={() => onNavigate('edit-vendor', { vendorId: v._id })}
                        style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 600 }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            Showing {vendors.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => loadVendors(pagination.page - 1)}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ fontWeight: 600, padding: '0 8px' }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadVendors(pagination.page + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vendors;
