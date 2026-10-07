const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { getMongoDb } = require('./mongo');
const eventPublisher = require('../events/eventPublisher');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sanitizeQuery(query) {
  if (!query || typeof query !== 'object') return {};
  const sanitized = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    // Strip prototype pollution
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    // Allow legitimate $or queries but sanitize each branch
    if (k === '$or' && Array.isArray(v)) {
      sanitized[k] = v.map(sanitizeQuery);
      continue;
    }
    // Block dangerous NoSQL operators at root query level
    if (k.startsWith('$')) continue;

    if (['_id', 'id', 'stateId', 'districtId', 'divisionId', 'pincodeId'].includes(k) && typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) {
      sanitized[k] = { $in: [new ObjectId(v), v] };
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof RegExp)) {
      // Disallow dangerous operators inside nested object queries
      const cleanSub = {};
      for (const [subK, subV] of Object.entries(v)) {
        if (subK === '$where' || subK === '$expr') continue;
        if (subK === '__proto__' || subK === 'constructor' || subK === 'prototype') continue;
        cleanSub[subK] = subV;
      }
      sanitized[k] = cleanSub;
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

class Collection {
  constructor(name, mongoCollectionName = null) {
    this.name = name;
    this.mongoName = mongoCollectionName || name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this._mongoCol = null;
    this._mongoDb = null;
    this._isReady = false;
    this.cache = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(content || '[]');
      } else {
        this.cache = [];
      }
    } catch (err) {
      this.cache = [];
    }
  }

  _write(data) {
    this.cache = data;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}
  }

  async initMongo(mongoDb) {
    if (!mongoDb) return;
    this._mongoDb = mongoDb;
    try {
      this._mongoCol = mongoDb.collection(this.mongoName);
      const projection = (this.mongoName === 'users' || this.mongoName === 'agents') 
        ? { projection: { kycDocs: 0, kyc: 0 } } 
        : {};
      const docs = await this._mongoCol.find({}, projection).toArray();
      if (docs && docs.length > 0) {
        this._write(docs);
        console.log(`[Manager MongoDB] Loaded ${docs.length} documents for '${this.name}' (${this.mongoName}) from MongoDB Atlas.`);
      } else {
        console.log(`[Manager MongoDB] Connected to '${this.mongoName}' (0 records) in MongoDB Atlas.`);
      }
      this._isReady = true;
    } catch (err) {
      console.warn(`[Manager MongoDB] Sync warning for '${this.name}':`, err.message);
    }
  }

  async find(query = {}) {
    const cleanQuery = sanitizeQuery(query);
    if (this._mongoCol) {
      try {
        const projection = (this.mongoName === 'users' || this.mongoName === 'agents') 
          ? { projection: { kycDocs: 0, kyc: 0 } } 
          : {};
        const docs = await this._mongoCol.find(cleanQuery, projection).toArray();
        if (docs && docs.length > 0) {
          return docs;
        }
        // Fallback for users: if querying role manager and nothing found, check managers collection
        if (this.name === 'users' && this._mongoDb) {
          const mgrDocs = await this._mongoDb.collection('managers').find(cleanQuery, projection).toArray();
          if (mgrDocs && mgrDocs.length > 0) return mgrDocs;
        }
        return docs || [];
      } catch (e) {
        console.warn(`[Manager MongoDB] find error in '${this.name}':`, e.message);
      }
    }

    // Fallback to cache if MongoDB is unreachable
    const records = this.cache || [];
    return records.filter(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (val && typeof val === 'object' && val.$in) {
          if (!val.$in.map(String).includes(String(item[key]))) return false;
        } else if (item[key] !== val) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const cleanQuery = sanitizeQuery(query);
    if (this._mongoCol) {
      try {
        const projection = (this.mongoName === 'users' || this.mongoName === 'agents') 
          ? { projection: { kycDocs: 0, kyc: 0 } } 
          : {};
        let doc = await this._mongoCol.findOne(cleanQuery, projection);
        if (doc) {
          const strId = String(doc._id || doc.id);
          const idx = (this.cache || []).findIndex(i => String(i._id || i.id) === strId);
          if (idx >= 0) this.cache[idx] = doc;
          else this.cache.push(doc);
          return doc;
        }

        // For users collection: also check 'managers' collection in MongoDB Atlas
        if (this.name === 'users' && this._mongoDb) {
          doc = await this._mongoDb.collection('managers').findOne(cleanQuery, projection);
          if (doc) {
            const strId = String(doc._id || doc.id);
            const idx = (this.cache || []).findIndex(i => String(i._id || i.id) === strId);
            if (idx >= 0) this.cache[idx] = doc;
            else this.cache.push(doc);
            return doc;
          }
        }
      } catch (e) {
        console.warn(`[Manager MongoDB] findOne error in '${this.name}':`, e.message);
      }
    }

    // Fallback to cache if Mongo is offline
    const records = this.cache || [];
    return records.find(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (item[key] !== val) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    if (!id) return null;
    const strId = String(id);
    if (this._mongoCol) {
      try {
        const orConditions = [{ _id: id }, { id: id }, { _id: strId }, { id: strId }];
        if (/^[0-9a-fA-F]{24}$/.test(strId)) {
          try {
            orConditions.push({ _id: new ObjectId(strId) });
          } catch (e) {}
        }
        const projection = (this.mongoName === 'users' || this.mongoName === 'agents') 
          ? { projection: { kycDocs: 0, kyc: 0 } } 
          : {};
        let doc = await this._mongoCol.findOne({ $or: orConditions }, projection);
        if (doc) {
          const idx = (this.cache || []).findIndex(i => String(i._id || i.id) === strId);
          if (idx >= 0) this.cache[idx] = doc;
          else this.cache.push(doc);
          return doc;
        }

        if (this.name === 'users' && this._mongoDb) {
          doc = await this._mongoDb.collection('managers').findOne({ $or: orConditions }, projection);
          if (doc) {
            const idx = (this.cache || []).findIndex(i => String(i._id || i.id) === strId);
            if (idx >= 0) this.cache[idx] = doc;
            else this.cache.push(doc);
            return doc;
          }
        }
      } catch (e) {
        console.warn(`[Manager MongoDB] findById error in '${this.name}':`, e.message);
      }
    }

    const records = this.cache || [];
    return records.find(item => String(item._id || item.id) === strId) || null;
  }

  async insertOne(doc) {
    const genId = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : uuidv4());
    const newDoc = {
      _id: genId,
      id: genId,
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString()
    };
    newDoc._id = String(newDoc._id);
    newDoc.id = String(newDoc.id);

    const records = this.cache || [];
    const idx = records.findIndex(i => String(i._id || i.id) === newDoc._id);
    if (idx >= 0) {
      records[idx] = newDoc;
    } else {
      records.push(newDoc);
    }
    this._write(records);

    if (this._mongoCol) {
      try {
        await this._mongoCol.updateOne(
          { $or: [{ _id: newDoc._id }, { id: newDoc.id }] },
          { $set: newDoc },
          { upsert: true }
        );
        // If inserting manager into users, sync to managers collection too
        if (this.name === 'users' && this._mongoDb && (newDoc.role || '').includes('manager')) {
          await this._mongoDb.collection('managers').updateOne(
            { $or: [{ _id: newDoc._id }, { id: newDoc.id }] },
            { $set: newDoc },
            { upsert: true }
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[Manager MongoDB] Insert error in ${this.name}:`, err.message);
      }
    }

    if (this._isReady) {
      eventPublisher.publishEntityEvent({
        entity: this.name,
        action: 'created',
        entityId: newDoc._id || newDoc.id,
        data: newDoc,
        scope: {
          stateId: newDoc.stateId || newDoc.state,
          districtId: newDoc.districtId || newDoc.district,
          divisionId: newDoc.divisionId || newDoc.division,
          pincodeId: newDoc.pincodeId || newDoc.pincode,
          targetUserId: newDoc.targetUserId || newDoc.assignedTo || newDoc.userId,
          role: newDoc.role
        }
      }).catch(() => {});
    }

    return newDoc;
  }

  async insertMany(docs) {
    const newDocs = docs.map(doc => {
      const genId = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : uuidv4());
      return {
        _id: String(genId),
        id: String(genId),
        ...doc,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString()
      };
    });

    const records = this.cache || [];
    for (const d of newDocs) {
      const idx = records.findIndex(i => String(i._id || i.id) === d._id);
      if (idx >= 0) {
        records[idx] = { ...records[idx], ...d };
      } else {
        records.push(d);
      }
    }
    this._write(records);

    if (this._mongoCol && newDocs.length > 0) {
      Promise.all(newDocs.map(d =>
        this._mongoCol.updateOne(
          { $or: [{ _id: d._id }, { id: d.id }] },
          { $set: d },
          { upsert: true }
        )
      )).catch(err => {
        console.error(`[Manager MongoDB] Async insertMany error in ${this.name}:`, err.message);
      });
    }

    return newDocs;
  }

  async updateOne(query, update) {
    const cleanQuery = sanitizeQuery(query);
    const records = this.cache || [];
    const index = records.findIndex(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    const patch = update.$set ? update.$set : update;
    let updated = null;
    if (index !== -1) {
      updated = {
        ...records[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };
      records[index] = updated;
      this._write(records);
    }

    if (this._mongoCol) {
      this._mongoCol.updateOne(cleanQuery, { $set: { ...patch, updatedAt: new Date().toISOString() } })
        .catch(err => {
          console.error(`[Manager MongoDB] updateOne error in ${this.name}:`, err.message);
        });
    }

    return updated;
  }

  async findByIdAndUpdate(id, update) {
    if (!id) return null;
    const strId = String(id);
    const patch = update.$set ? update.$set : update;
    let updated = null;

    if (this._mongoCol) {
      try {
        const orConditions = [{ _id: id }, { id: id }, { _id: strId }, { id: strId }];
        if (/^[0-9a-fA-F]{24}$/.test(strId)) {
          try {
            orConditions.push({ _id: new ObjectId(strId) });
          } catch (e) {}
        }
        await this._mongoCol.updateOne(
          { $or: orConditions },
          { $set: { ...patch, updatedAt: new Date().toISOString() } }
        );
        updated = await this.findById(id);

        if (this.name === 'users' && this._mongoDb) {
          await this._mongoDb.collection('managers').updateOne(
            { $or: orConditions },
            { $set: { ...patch, updatedAt: new Date().toISOString() } }
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[Manager MongoDB] findByIdAndUpdate error in ${this.name}:`, err.message);
      }
    }

    const records = this.cache || [];
    const index = records.findIndex(item => String(item._id || item.id) === strId);
    if (index !== -1) {
      records[index] = {
        ...records[index],
        ...patch,
        updatedAt: new Date().toISOString()
      };
      updated = updated || records[index];
      this._write(records);
    } else if (updated) {
      records.push(updated);
      this._write(records);
    }

    if (this._isReady && updated) {
      eventPublisher.publishEntityEvent({
        entity: this.name,
        action: 'updated',
        entityId: updated._id || updated.id,
        data: updated,
        scope: {
          stateId: updated.stateId || updated.state,
          districtId: updated.districtId || updated.district,
          divisionId: updated.divisionId || updated.division,
          pincodeId: updated.pincodeId || updated.pincode,
          targetUserId: updated.targetUserId || updated.assignedTo || updated.userId,
          role: updated.role
        }
      }).catch(() => {});
    }

    return updated;
  }

  async deleteOne(query) {
    const cleanQuery = sanitizeQuery(query);
    const records = this.cache || [];
    const filtered = records.filter(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (item[key] === val) return false;
      }
      return true;
    });
    this._write(filtered);

    if (this._mongoCol) {
      this._mongoCol.deleteOne(cleanQuery).catch(err => {
        console.error(`[Manager MongoDB] deleteOne error in ${this.name}:`, err.message);
      });
      if (this.name === 'users' && this._mongoDb) {
        this._mongoDb.collection('managers').deleteOne(cleanQuery).catch(() => {});
      }
    }

    return { deletedCount: records.length - filtered.length };
  }

  async count(query = {}) {
    const items = await this.find(query);
    return items.length;
  }

  async clear() {
    this._write([]);
    if (this._mongoCol) {
      try {
        await this._mongoCol.deleteMany({});
      } catch (e) {}
    }
  }
}

const db = {
  users: new Collection('users', 'users'),
  managers: new Collection('managers', 'managers'),
  states: new Collection('states', 'states'),
  districts: new Collection('districts', 'districts'),
  divisions: new Collection('divisions', 'divisions'),
  pincodes: new Collection('pincodes', 'pincodes'),
  vendors: new Collection('vendors', 'vendors'),
  auditLogs: new Collection('audit_logs', 'auditlogs'),
  tasks: new Collection('tasks', 'tasks'),
  shopVisits: new Collection('shop_visits', 'fieldvisits'),
  managerOnboardings: new Collection('manager_onboardings', 'manageronboardings'),
  submittedReports: new Collection('submitted_reports', 'reports'),
  agents: new Collection('agents', 'agents'),
  notifications: new Collection('notifications', 'notifications'),
  settings: new Collection('settings', 'settings')
};


let initPromise = null;
function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mongoDb = await getMongoDb();
      if (!mongoDb) {
        console.warn('[Manager Database] MongoDB Atlas not reachable, using local store.');
        return false;
      }
      const collections = Object.values(db).filter(c => c && typeof c.initMongo === 'function');
      await Promise.all(collections.map(col => col.initMongo(mongoDb)));
      console.log('✅ [Manager Database] All Manager collections linked directly to MongoDB Atlas single source of truth.');

      // Ensure performance indexes in MongoDB Atlas
      try {
        await Promise.allSettled([
          mongoDb.collection('users').createIndex({ email: 1 }),
          mongoDb.collection('users').createIndex({ mobile: 1 }),
          mongoDb.collection('users').createIndex({ phone: 1 }),
          mongoDb.collection('users').createIndex({ role: 1, status: 1 }),
          mongoDb.collection('managers').createIndex({ email: 1 }),
          mongoDb.collection('managers').createIndex({ role: 1, status: 1 }),
          mongoDb.collection('vendors').createIndex({ status: 1, kycStatus: 1 }),
          mongoDb.collection('vendors').createIndex({ pincode: 1 }),
          mongoDb.collection('tasks').createIndex({ status: 1, createdAt: -1 }),
          mongoDb.collection('tasks').createIndex({ assignedTo: 1 }),
          mongoDb.collection('agents').createIndex({ status: 1 }),
          mongoDb.collection('notifications').createIndex({ userId: 1, isRead: 1 }),
          mongoDb.collection('pincodes').createIndex({ code: 1 }),
          mongoDb.collection('districts').createIndex({ stateId: 1 }),
          mongoDb.collection('divisions').createIndex({ districtId: 1 }),
          mongoDb.collection('manageronboardings').createIndex({ managerId: 1, status: 1 }),
          mongoDb.collection('manageronboardings').createIndex({ pincodeId: 1, status: 1 })
        ]);
        console.log('⚡ [Manager Database] Performance indexes verified in MongoDB Atlas.');
      } catch (idxErr) {}

      return true;
    } catch (err) {
      console.error('[Manager Database] Init error:', err.message);
      return false;
    }
  })();
  return initPromise;
}

initDatabase().catch(e => console.warn('[Manager Database] Auto-init:', e.message));

db.initDatabase = initDatabase;
module.exports = db;
