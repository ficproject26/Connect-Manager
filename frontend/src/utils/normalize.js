/**
 * Centralized normalization and safe display helpers for Manager Website
 * Eliminates Minified React error #31 and string method TypeErrors on non-string values.
 */

export const normalizeString = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(
      value.name ??
      value.label ??
      value.title ??
      value.code ??
      value.value ??
      value.role ??
      value.level ??
      ''
    ).trim();
  }
  return String(value).trim();
};

export const getDisplayValue = (value, fallback = '-') => {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim();
    return s.length > 0 ? s : fallback;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) return fallback;
      return value.map(v => getDisplayValue(v, fallback)).join(', ');
    }
    const val = value.name ??
      value.label ??
      value.title ??
      value.code ??
      value.pincode ??
      value.pincodeCode ??
      value.districtName ??
      value.divisionName ??
      value.stateName ??
      value.area ??
      value.value;
    
    if (val != null && typeof val !== 'object') {
      const s = String(val).trim();
      if (s.length > 0) return s;
    }
    return fallback;
  }
  return String(value).trim() || fallback;
};

export const getTerritoryDisplay = (territory, fallback = '-') => {
  if (!territory) return fallback;
  if (typeof territory === 'string') return territory.trim() || fallback;
  if (typeof territory === 'object') {
    const name = territory.name ??
      territory.stateName ??
      territory.districtName ??
      territory.divisionName ??
      territory.pincode ??
      territory.code ??
      territory.area;
    if (name && typeof name !== 'object') return String(name).trim();

    const parts = [
      getDisplayValue(territory.district, ''),
      getDisplayValue(territory.division, ''),
      getDisplayValue(territory.state, '')
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  return fallback;
};

export const normalizeLevelRole = (level, role) => {
  const normRole = normalizeString(role).toLowerCase();
  const normLevel = normalizeString(level).toLowerCase();

  if (normLevel === '1' || normLevel === 'state' || normRole.includes('state')) return 'state';
  if (normLevel === '2' || normLevel === 'district' || normRole.includes('district')) return 'district';
  if (normLevel === '3' || normLevel === 'division' || normRole.includes('division') || normRole.includes('divisional')) return 'division';
  if (normLevel === '4' || normLevel === 'pincode' || normRole.includes('pincode')) return 'pincode';

  return normLevel || normRole || 'pincode';
};

export const formatRoleLabel = (role, level) => {
  const tier = normalizeLevelRole(level, role);
  switch (tier) {
    case 'state': return 'State Manager';
    case 'district': return 'District Manager';
    case 'division': return 'Division Manager';
    case 'pincode': return 'Pincode Manager';
    default: return 'Agent Manager';
  }
};
