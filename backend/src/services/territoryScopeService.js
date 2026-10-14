const db = require('../config/db');

const norm = (s) => (s !== undefined && s !== null ? String(s).trim().toLowerCase() : '');
const normClean = (s) => (s !== undefined && s !== null ? String(s).trim().toLowerCase().replace(/\s+(division|taluk|sub-division|circle)$/i, '').trim() : '');

/**
 * Centralized Territory Hierarchy & Authorization Service
 * Single source of truth for:
 * - Territory resolution (State -> District -> Division -> Pincode)
 * - Scope checking across all 4 Manager roles
 * - Role hierarchy enforcement (State > District > Division > Pincode)
 */
class TerritoryScopeService {
  constructor() {
    this._states = [];
    this._districts = [];
    this._divisions = [];
    this._pincodes = [];
    this._lastSync = 0;
    this._syncPromise = null;
  }

  async _ensureSync() {
    const now = Date.now();
    // Refresh memory cache every 60 seconds
    if (this._states.length > 0 && (now - this._lastSync < 60000)) {
      return;
    }
    if (this._syncPromise) return this._syncPromise;

    this._syncPromise = (async () => {
      try {
        const [states, districts, divisions, pincodes] = await Promise.all([
          db.states.find({ status: 'Active' }).catch(() => db.states.find()),
          db.districts.find({ status: 'Active' }).catch(() => db.districts.find()),
          db.divisions.find({ status: 'Active' }).catch(() => db.divisions.find()),
          db.pincodes.find({ status: 'Active' }).catch(() => db.pincodes.find())
        ]);

        this._states = states || [];
        this._districts = districts || [];
        this._divisions = divisions || [];
        this._pincodes = pincodes || [];
        this._lastSync = Date.now();
      } catch (err) {
        console.warn('[TerritoryScopeService] Sync warning:', err.message);
      } finally {
        this._syncPromise = null;
      }
    })();

    return this._syncPromise;
  }

  /**
   * Resolve any record's full territorial hierarchy from IDs or Names.
   * Explicit assigned fields (state, district, division) take precedence
   * so that a manager's personal address pincode does not override their assigned jurisdiction.
   */
  async resolveTerritory(record) {
    if (!record) return {};
    await this._ensureSync();

    const stateById = new Map(this._states.map(s => [String(s._id || s.id), s]));
    const stateByName = new Map(this._states.map(s => [norm(s.name), s]));

    const distById = new Map(this._districts.map(d => [String(d._id || d.id), d]));
    const distByName = new Map(this._districts.map(d => [norm(d.name), d]));

    const divById = new Map(this._divisions.map(d => [String(d._id || d.id), d]));
    const divByName = new Map(this._divisions.map(d => [norm(d.name), d]));
    const divByCleanName = new Map(this._divisions.map(d => [normClean(d.name), d]));

    const pinById = new Map(this._pincodes.map(p => [String(p._id || p.id), p]));
    const pinByCode = new Map(this._pincodes.map(p => [norm(p.code || p.pincode), p]));

    let pinDoc = null;
    let divDoc = null;
    let distDoc = null;
    let stateDoc = null;

    // 1. Direct Resolution of Explicit Fields First
    // State
    if (record.stateId && stateById.has(String(record.stateId))) {
      stateDoc = stateById.get(String(record.stateId));
    }
    if (!stateDoc && (record.state || record.stateName || record.assignedState)) {
      const st = norm(record.state || record.stateName || record.assignedState);
      if (stateByName.has(st)) stateDoc = stateByName.get(st);
    }

    // District
    if (record.districtId && distById.has(String(record.districtId))) {
      distDoc = distById.get(String(record.districtId));
    }
    if (!distDoc && (record.district || record.districtName || record.assignedDistrict)) {
      const dt = norm(record.district || record.districtName || record.assignedDistrict);
      if (distByName.has(dt)) distDoc = distByName.get(dt);
    }

    // Division
    if (record.divisionId && divById.has(String(record.divisionId))) {
      divDoc = divById.get(String(record.divisionId));
    }
    if (!divDoc && (record.division || record.divisionName || record.assignedDivision)) {
      const rawDiv = record.division || record.divisionName || record.assignedDivision;
      const d = norm(rawDiv);
      const cleanD = normClean(rawDiv);
      if (divByName.has(d)) {
        divDoc = divByName.get(d);
      } else if (divByCleanName.has(cleanD)) {
        divDoc = divByCleanName.get(cleanD);
      }
    }

    // Pincode
    if (record.pincodeId && pinById.has(String(record.pincodeId))) {
      pinDoc = pinById.get(String(record.pincodeId));
    }
    if (!pinDoc && (record.pincode || record.pincodeCode || record.assignedPincode)) {
      const code = norm(record.pincode || record.pincodeCode || record.assignedPincode);
      if (pinByCode.has(code)) pinDoc = pinByCode.get(code);
    }

    // 2. Hierarchical Inference for Missing Levels (Bottom-up fallback)
    // If District exists but State is missing, infer State from District
    if (distDoc && !stateDoc) {
      if (distDoc.stateId && stateById.has(String(distDoc.stateId))) {
        stateDoc = stateById.get(String(distDoc.stateId));
      } else if (distDoc.state && stateByName.has(norm(distDoc.state))) {
        stateDoc = stateByName.get(norm(distDoc.state));
      }
    }

    // If Division exists, infer District and State if missing
    if (divDoc) {
      if (!distDoc) {
        if (divDoc.districtId && distById.has(String(divDoc.districtId))) {
          distDoc = distById.get(String(divDoc.districtId));
        } else if (divDoc.district && distByName.has(norm(divDoc.district))) {
          distDoc = distByName.get(norm(divDoc.district));
        }
      }
      if (!stateDoc) {
        if (divDoc.stateId && stateById.has(String(divDoc.stateId))) {
          stateDoc = stateById.get(String(divDoc.stateId));
        } else if (distDoc) {
          if (distDoc.stateId && stateById.has(String(distDoc.stateId))) {
            stateDoc = stateById.get(String(distDoc.stateId));
          } else if (distDoc.state && stateByName.has(norm(distDoc.state))) {
            stateDoc = stateByName.get(norm(distDoc.state));
          }
        }
      }
    }

    // If Pincode exists, infer missing Division, District, State
    if (pinDoc) {
      if (!divDoc) {
        if (pinDoc.divisionId && divById.has(String(pinDoc.divisionId))) {
          divDoc = divById.get(String(pinDoc.divisionId));
        } else if (pinDoc.division) {
          const d = norm(pinDoc.division);
          const cd = normClean(pinDoc.division);
          if (divByName.has(d)) divDoc = divByName.get(d);
          else if (divByCleanName.has(cd)) divDoc = divByCleanName.get(cd);
        }
      }
      if (!distDoc) {
        if (pinDoc.districtId && distById.has(String(pinDoc.districtId))) {
          distDoc = distById.get(String(pinDoc.districtId));
        } else if (pinDoc.district && distByName.has(norm(pinDoc.district))) {
          distDoc = distByName.get(norm(pinDoc.district));
        } else if (divDoc) {
          if (divDoc.districtId && distById.has(String(divDoc.districtId))) {
            distDoc = distById.get(String(divDoc.districtId));
          } else if (divDoc.district && distByName.has(norm(divDoc.district))) {
            distDoc = distByName.get(norm(divDoc.district));
          }
        }
      }
      if (!stateDoc) {
        if (pinDoc.stateId && stateById.has(String(pinDoc.stateId))) {
          stateDoc = stateById.get(String(pinDoc.stateId));
        } else if (pinDoc.state && stateByName.has(norm(pinDoc.state))) {
          stateDoc = stateByName.get(norm(pinDoc.state));
        } else if (distDoc && distDoc.stateId && stateById.has(String(distDoc.stateId))) {
          stateDoc = stateById.get(String(distDoc.stateId));
        }
      }
    }

    return {
      stateId: stateDoc ? String(stateDoc._id || stateDoc.id) : (record.stateId ? String(record.stateId) : null),
      stateName: stateDoc ? stateDoc.name : (record.state || record.stateName || null),
      districtId: distDoc ? String(distDoc._id || distDoc.id) : (record.districtId ? String(record.districtId) : null),
      districtName: distDoc ? distDoc.name : (record.district || record.districtName || null),
      divisionId: divDoc ? String(divDoc._id || divDoc.id) : (record.divisionId ? String(record.divisionId) : null),
      divisionName: divDoc ? divDoc.name : (record.division || record.divisionName || null),
      pincodeId: pinDoc ? String(pinDoc._id || pinDoc.id) : (record.pincodeId ? String(record.pincodeId) : null),
      pincodeCode: pinDoc ? String(pinDoc.code || pinDoc.pincode) : (record.pincode || record.pincodeCode ? String(record.pincode || record.pincodeCode) : null),
      areaName: pinDoc ? (pinDoc.areaName || pinDoc.area || pinDoc.name || null) : (record.area || record.areaName || null)
    };
  }

  /**
   * Normalize user role level:
   * 1: state_manager / state_admin
   * 2: district_manager / district_admin
   * 3: division_manager / division_admin
   * 4: pincode_manager / pincode_admin
   * 0: super_admin / global system admin
   */
  getRoleLevel(role) {
    const r = norm(role);
    if (r.includes('pincode') || r.includes('pin_')) return 4;
    if (r.includes('division') || r.includes('divisional')) return 3;
    if (r.includes('district')) return 2;
    if (r.includes('state')) return 1;
    if (r.includes('super_admin') || r.includes('super-admin') || r === 'admin' || r === 'system_admin') return 0;
    return 99;
  }

  /**
   * Check if a record is within the authenticated manager's authorized territory scope.
   */
  async isRecordInScope(record, user) {
    if (!record || !user) return false;
    const userRoleLevel = this.getRoleLevel(user.role);

    // Global Admin has pan-India scope
    if (userRoleLevel === 0 || user.email === 'admin@example.com' || String(user.id || user._id) === 'user_admin') {
      return true;
    }

    // Owner always has access to their own record
    const isOwner = String(record.recordedById || record.managerId || record.userId || record.createdBy || '') === String(user.id || user._id);
    if (isOwner) return true;

    const resRecord = await this.resolveTerritory(record);
    const resUser = await this.resolveTerritory(user);

    // 1. PINCODE MANAGER (Level 4): Strictly restricted to assigned pincode
    if (userRoleLevel === 4) {
      if (resUser.pincodeId && resRecord.pincodeId && String(resUser.pincodeId) === String(resRecord.pincodeId)) return true;
      if (resUser.pincodeCode && resRecord.pincodeCode && norm(resUser.pincodeCode) === norm(resRecord.pincodeCode)) return true;
      return false;
    }

    // Check State Match (Mandatory for Level 1, 2, 3)
    const matchState = () => {
      if (resUser.stateId && resRecord.stateId) {
        if (String(resUser.stateId) === String(resRecord.stateId)) return true;
      }
      if (resUser.stateName && resRecord.stateName) {
        if (norm(resUser.stateName) === norm(resRecord.stateName)) return true;
      }
      return false;
    };

    if (!matchState()) return false;

    // 2. STATE MANAGER (Level 1): Entire assigned state
    if (userRoleLevel === 1) {
      return true;
    }

    // Check District Match
    const matchDistrict = () => {
      if (resUser.districtId && resRecord.districtId) {
        if (String(resUser.districtId) === String(resRecord.districtId)) return true;
      }
      if (resUser.districtName && resRecord.districtName) {
        if (normClean(resUser.districtName) === normClean(resRecord.districtName)) return true;
      }
      return false;
    };

    if (!matchDistrict()) return false;

    // 3. DISTRICT MANAGER (Level 2): Entire assigned district
    if (userRoleLevel === 2) {
      return true;
    }

    // Check Division Match
    const matchDivision = () => {
      if (resUser.divisionId && resRecord.divisionId) {
        if (String(resUser.divisionId) === String(resRecord.divisionId)) return true;
      }
      if (resUser.divisionName && resRecord.divisionName) {
        if (normClean(resUser.divisionName) === normClean(resRecord.divisionName)) return true;
      }
      return false;
    };

    // 4. DIVISION MANAGER (Level 3): Entire assigned division
    if (userRoleLevel === 3) {
      return matchDivision();
    }

    return false;
  }

  /**
   * Determine whether a shop visit report or submitted report is visible to the user under a specific tab/scope:
   * - 'self' (My Reports): ONLY created by the authenticated user
   * - 'all' (All Reports): strictly follows role hierarchy:
   *    - State Manager: self + all subordinate district, division, pincode managers in state
   *    - District Manager: self + all subordinate division, pincode managers in district (NEVER state managers!)
   *    - Division Manager: self + all subordinate pincode managers in division (NEVER state or district managers!)
   *    - Pincode Manager: self + managers in same pincode (NEVER other pincodes/divisions/districts/states)
   * - 'state_managers': state managers in state (State Manager only)
   * - 'district_managers': district managers in territory (State, District Manager only)
   * - 'division_managers': division managers in territory (State, District, Division Manager only)
   * - 'pincode_managers': pincode managers in territory (All roles within their scope)
   */
  async isReportVisible(report, user, scope = 'all') {
    if (!report || !user) return false;

    const userLevel = this.getRoleLevel(user.role);
    const isGlobalAdmin = userLevel === 0 || user.email === 'admin@example.com';
    const isOwner = String(report.recordedById || report.managerId || report.userId || report.createdBy || '') === String(user.id || user._id);

    // 1. My Reports: Strictly authenticated user's own reports
    if (scope === 'self' || scope === 'my_reports') {
      return isOwner;
    }

    // Verify territory boundary first
    const inTerritory = await this.isRecordInScope(report, user);
    if (!inTerritory && !isGlobalAdmin) return false;

    const reportRole = report.managerRole || report.recordedByRole || report.role || '';
    const reportLevel = this.getRoleLevel(reportRole);

    // Strict Rule: A lower-tier manager can NEVER access report history of a higher-tier manager
    if (!isOwner && !isGlobalAdmin) {
      if (reportLevel < userLevel) return false;
      if (reportLevel === 99) return false; // Fail closed on unknown or invalid role
    }

    // 2. Specific role tabs
    if (scope === 'state_managers') {
      if (userLevel > 1 && !isGlobalAdmin) return false; // District, Division, Pincode managers CANNOT see state managers tab
      return reportLevel === 1;
    }
    if (scope === 'district_managers') {
      if (userLevel > 2 && !isGlobalAdmin) return false; // Division, Pincode managers CANNOT see district managers tab
      return reportLevel === 2;
    }
    if (scope === 'division_managers') {
      if (userLevel > 3 && !isGlobalAdmin) return false; // Pincode managers CANNOT see division managers tab
      return reportLevel === 3;
    }
    if (scope === 'pincode_managers') {
      return reportLevel === 4;
    }

    // 3. "All Reports" Tab (scope === 'all' or empty)
    if (isGlobalAdmin) return true;

    // A. State Manager: self + all authorized subordinates in state
    if (userLevel === 1) {
      return inTerritory;
    }

    // B. District Manager: self + subordinate Division & Pincode managers in district (NEVER State Managers!)
    if (userLevel === 2) {
      if (isOwner) return true;
      if (reportLevel < 2) return false;
      return inTerritory;
    }

    // C. Division Manager: self + subordinate Pincode managers in division (NEVER State or District Managers!)
    if (userLevel === 3) {
      if (isOwner) return true;
      if (reportLevel < 3) return false;
      return inTerritory;
    }

    // D. Pincode Manager: only managers authorized in the same pincode
    if (userLevel === 4) {
      if (isOwner) return true;
      if (reportLevel < 4) return false;
      return inTerritory;
    }

    return isOwner;
  }

  /**
   * Filter and aggregate territory performance for a user
   */
  async getTerritoryPerformance(user, filter = 'dist') {
    if (!user) return [];
    await this._ensureSync();
    const userLevel = this.getRoleLevel(user.role || '');
    const resUser = await this.resolveTerritory(user);

    const [allVendors, allVisits] = await Promise.all([
      db.vendors.find(),
      db.shopVisits.find()
    ]);

    // Resolve territory for each vendor and visit
    const scopedVendors = [];
    for (const v of allVendors) {
      if (await this.isRecordInScope(v, user)) {
        const resolved = await this.resolveTerritory(v);
        scopedVendors.push({ ...v, _resolved: resolved });
      }
    }

    const scopedVisits = [];
    for (const vis of allVisits) {
      if (await this.isRecordInScope(vis, user)) {
        const resolved = await this.resolveTerritory(vis);
        scopedVisits.push({ ...vis, _resolved: resolved });
      }
    }

    const isVendorActive = (s) => {
      const st = norm(s);
      return st === 'active' || st === 'approved' || st === 'completed';
    };

    if (filter === 'state') {
      const stateMap = new Map();
      let candidateStates = this._states;
      if (userLevel >= 1 && resUser.stateId) {
        candidateStates = candidateStates.filter(s => String(s._id || s.id) === String(resUser.stateId));
      }

      candidateStates.forEach(s => {
        const key = String(s._id || s.id);
        stateMap.set(key, {
          stateId: key,
          stateName: s.name,
          totalVendors: 0,
          activeVendors: 0,
          tieUps: 0,
          shopVisits: 0
        });
      });

      scopedVendors.forEach(v => {
        const sId = v._resolved.stateId;
        const sName = v._resolved.stateName;
        if (!sId && !sName) return;

        let rec = stateMap.get(sId);
        if (!rec && sName) {
          rec = Array.from(stateMap.values()).find(r => norm(r.stateName) === norm(sName));
        }
        if (!rec) {
          rec = { stateId: sId || sName, stateName: sName || 'State', totalVendors: 0, activeVendors: 0, tieUps: 0, shopVisits: 0 };
          stateMap.set(sId || sName, rec);
        }
        rec.totalVendors++;
        if (isVendorActive(v.status)) { rec.activeVendors++; rec.tieUps++; }
      });

      scopedVisits.forEach(vis => {
        const sId = vis._resolved.stateId;
        const sName = vis._resolved.stateName;
        if (!sId && !sName) return;

        let rec = stateMap.get(sId);
        if (!rec && sName) {
          rec = Array.from(stateMap.values()).find(r => norm(r.stateName) === norm(sName));
        }
        if (rec) rec.shopVisits++;
      });

      return Array.from(stateMap.values())
        .filter(s => s.totalVendors > 0 || s.shopVisits > 0 || userLevel >= 1)
        .sort((a, b) => (b.totalVendors + b.shopVisits) - (a.totalVendors + a.shopVisits));
    }

    if (filter === 'dist') {
      // Aggregate by District
      const districtMap = new Map();

      // Seed districts in user's authorized scope
      let candidateDistricts = this._districts;
      if (userLevel === 1 && resUser.stateId) {
        candidateDistricts = candidateDistricts.filter(d => String(d.stateId) === String(resUser.stateId));
      } else if (userLevel >= 2 && resUser.districtId) {
        candidateDistricts = candidateDistricts.filter(d => String(d._id || d.id) === String(resUser.districtId));
      }

      candidateDistricts.forEach(d => {
        const key = String(d._id || d.id);
        districtMap.set(key, {
          districtId: key,
          districtName: d.name,
          totalVendors: 0,
          activeVendors: 0,
          tieUps: 0,
          shopVisits: 0
        });
      });

      // Aggregate scoped vendors
      scopedVendors.forEach(v => {
        const dId = v._resolved.districtId;
        const dName = v._resolved.districtName;
        if (!dId && !dName) return;

        let rec = districtMap.get(dId);
        if (!rec && dName) {
          const match = Array.from(districtMap.values()).find(r => norm(r.districtName) === norm(dName));
          if (match) rec = match;
        }
        if (!rec) {
          rec = { districtId: dId || dName, districtName: dName || 'District', totalVendors: 0, activeVendors: 0, tieUps: 0, shopVisits: 0 };
          districtMap.set(dId || dName, rec);
        }
        rec.totalVendors++;
        if (isVendorActive(v.status)) { rec.activeVendors++; rec.tieUps++; }
      });

      // Aggregate scoped shop visits
      scopedVisits.forEach(vis => {
        const dId = vis._resolved.districtId;
        const dName = vis._resolved.districtName;
        if (!dId && !dName) return;

        let rec = districtMap.get(dId);
        if (!rec && dName) {
          const match = Array.from(districtMap.values()).find(r => norm(r.districtName) === norm(dName));
          if (match) rec = match;
        }
        if (rec) rec.shopVisits++;
      });

      return Array.from(districtMap.values())
        .filter(d => d.totalVendors > 0 || d.shopVisits > 0 || userLevel >= 2)
        .sort((a, b) => (b.totalVendors + b.shopVisits) - (a.totalVendors + a.shopVisits));
    }

    if (filter === 'div') {
      // Aggregate by Division
      const divisionMap = new Map();

      let candidateDivisions = this._divisions;
      if (userLevel === 1 && resUser.stateId) {
        candidateDivisions = candidateDivisions.filter(div => {
          const dist = this._districts.find(d => String(d._id || d.id) === String(div.districtId));
          return dist && String(dist.stateId) === String(resUser.stateId);
        });
      } else if (userLevel === 2 && resUser.districtId) {
        candidateDivisions = candidateDivisions.filter(div => String(div.districtId) === String(resUser.districtId));
      } else if (userLevel >= 3 && resUser.divisionId) {
        candidateDivisions = candidateDivisions.filter(div => String(div._id || div.id) === String(resUser.divisionId));
      }

      candidateDivisions.forEach(div => {
        const key = String(div._id || div.id);
        divisionMap.set(key, {
          divisionId: key,
          divisionName: div.name,
          totalVendors: 0,
          activeVendors: 0,
          tieUps: 0,
          shopVisits: 0
        });
      });

      scopedVendors.forEach(v => {
        const divId = v._resolved.divisionId;
        const divName = v._resolved.divisionName;
        if (!divId && !divName) return;

        let rec = divisionMap.get(divId);
        if (!rec && divName) {
          const match = Array.from(divisionMap.values()).find(r => norm(r.divisionName) === norm(divName));
          if (match) rec = match;
        }
        if (!rec) {
          rec = { divisionId: divId || divName, divisionName: divName || 'Division', totalVendors: 0, activeVendors: 0, tieUps: 0, shopVisits: 0 };
          divisionMap.set(divId || divName, rec);
        }
        rec.totalVendors++;
        if (isVendorActive(v.status)) { rec.activeVendors++; rec.tieUps++; }
      });

      scopedVisits.forEach(vis => {
        const divId = vis._resolved.divisionId;
        const divName = vis._resolved.divisionName;
        if (!divId && !divName) return;

        let rec = divisionMap.get(divId);
        if (!rec && divName) {
          const match = Array.from(divisionMap.values()).find(r => norm(r.divisionName) === norm(divName));
          if (match) rec = match;
        }
        if (rec) rec.shopVisits++;
      });

      return Array.from(divisionMap.values())
        .filter(d => d.totalVendors > 0 || d.shopVisits > 0 || userLevel >= 3)
        .sort((a, b) => (b.totalVendors + b.shopVisits) - (a.totalVendors + a.shopVisits));
    }

    if (filter === 'pin') {
      // Aggregate by Pincode
      const pincodeMap = new Map();

      scopedVendors.forEach(v => {
        const pCode = v._resolved.pincodeCode;
        const pId = v._resolved.pincodeId || pCode;
        if (!pCode) return;

        if (!pincodeMap.has(pCode)) {
          pincodeMap.set(pCode, {
            pincodeId: pId,
            pincodeCode: pCode,
            areaName: v._resolved.areaName || v._resolved.divisionName || '',
            totalVendors: 0,
            activeVendors: 0,
            tieUps: 0,
            shopVisits: 0
          });
        }
        const rec = pincodeMap.get(pCode);
        rec.totalVendors++;
        if (isVendorActive(v.status)) { rec.activeVendors++; rec.tieUps++; }
      });

      scopedVisits.forEach(vis => {
        const pCode = vis._resolved.pincodeCode;
        const pId = vis._resolved.pincodeId || pCode;
        if (!pCode) return;

        if (!pincodeMap.has(pCode)) {
          pincodeMap.set(pCode, {
            pincodeId: pId,
            pincodeCode: pCode,
            areaName: vis._resolved.areaName || vis._resolved.divisionName || '',
            totalVendors: 0,
            activeVendors: 0,
            tieUps: 0,
            shopVisits: 0
          });
        }
        const rec = pincodeMap.get(pCode);
        rec.shopVisits++;
      });

      // Ensure logged-in pincode manager's assigned PIN is always included
      if (userLevel === 4 && resUser.pincodeCode && !pincodeMap.has(resUser.pincodeCode)) {
        pincodeMap.set(resUser.pincodeCode, {
          pincodeId: resUser.pincodeId || resUser.pincodeCode,
          pincodeCode: resUser.pincodeCode,
          areaName: resUser.areaName || 'Assigned Area',
          totalVendors: 0,
          activeVendors: 0,
          tieUps: 0,
          shopVisits: 0
        });
      }

      return Array.from(pincodeMap.values())
        .sort((a, b) => (b.totalVendors + b.shopVisits) - (a.totalVendors + a.shopVisits));
    }

    return [];
  }
}

const territoryScopeService = new TerritoryScopeService();
module.exports = territoryScopeService;
