const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { getMongoDb } = require('./mongo');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sanitizeQuery(query) {
  if (!query || typeof query !== 'object') return {};
  const sanitized = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (['_id', 'id', 'stateId', 'districtId', 'divisionId', 'pincodeId'].includes(k) && typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) {
      sanitized[k] = { $in: [new ObjectId(v), v] };
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
    this._ensureFile();
    this._load();
  }

  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
      } catch (e) {}
    }
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
    try {
      this._mongoCol = mongoDb.collection(this.mongoName);
      const docs = await this._mongoCol.find({}).toArray();
      if (docs && docs.length > 0) {
        // Merge with existing cache to preserve local configurations & managers
        const docMap = new Map();
        for (const d of docs) {
          const key = d.email ? String(d.email).toLowerCase() : String(d._id || d.id);
          docMap.set(key, d);
        }
        const missing = [];
        for (const item of (this.cache || [])) {
          const key = item.email ? String(item.email).toLowerCase() : String(item._id || item.id);
          if (!docMap.has(key)) {
            docMap.set(key, item);
            missing.push(item);
          }
        }
        if (missing.length > 0) {
          await this._mongoCol.insertMany(missing, { ordered: false }).catch(() => {});
        }
        const merged = Array.from(docMap.values());
        this._write(merged);
        console.log(`[Manager MongoDB] Loaded & synced ${merged.length} documents for '${this.name}' (${this.mongoName})`);
      } else if (this.cache && this.cache.length > 0) {
        await this._mongoCol.insertMany(this.cache, { ordered: false }).catch(() => {});
        console.log(`[Manager MongoDB] Seeded ${this.cache.length} documents into '${this.mongoName}'`);
      }
    } catch (err) {
      console.warn(`[Manager MongoDB] Sync warning for '${this.name}':`, err.message);
    }
  }

  async find(query = {}) {
    const cleanQuery = sanitizeQuery(query);
    const records = this.cache || [];
    if (records.length > 0) {
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

    if (this._mongoCol) {
      try {
        const mongoPromise = this._mongoCol.find(cleanQuery).toArray();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo timeout')), 400));
        return await Promise.race([mongoPromise, timeoutPromise]);
      } catch (e) {}
    }
    return [];
  }

  async findOne(query = {}) {
    const cleanQuery = sanitizeQuery(query);
    const records = this.cache || [];
    const cached = records.find(item => {
      for (const [key, val] of Object.entries(cleanQuery)) {
        if (item[key] !== val) return false;
      }
      return true;
    });
    if (cached) return cached;

    if (this._mongoCol) {
      try {
        const mongoPromise = this._mongoCol.findOne(cleanQuery);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo timeout')), 400));
        const doc = await Promise.race([mongoPromise, timeoutPromise]);
        if (doc) return doc;
      } catch (e) {}
    }
    return null;
  }

  async findById(id) {
    if (!id) return null;
    const strId = String(id);
    const records = this.cache || [];
    const cached = records.find(item => String(item._id || item.id) === strId);
    if (cached) return cached;

    if (this._mongoCol) {
      try {
        const orConditions = [{ _id: id }, { id: id }, { _id: strId }, { id: strId }];
        if (/^[0-9a-fA-F]{24}$/.test(strId)) {
          try {
            orConditions.push({ _id: new ObjectId(strId) });
          } catch (e) {}
        }
        const mongoPromise = this._mongoCol.findOne({ $or: orConditions });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo timeout')), 400));
        const doc = await Promise.race([mongoPromise, timeoutPromise]);
        if (doc) return doc;
      } catch (e) {}
    }
    return null;
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
      this._mongoCol.updateOne(
        { $or: [{ _id: newDoc._id }, { id: newDoc.id }] },
        { $set: newDoc },
        { upsert: true }
      ).catch(err => {
        console.error(`[Manager MongoDB] Async insert error in ${this.name}:`, err.message);
      });
    }

    return newDoc;
  }

  async insertMany(docs) {
    const newDocs = docs.map(doc => {
      const genId = doc._id ? String(doc._id) : (doc.id ? String(doc.id) : uuidv4());
      return {
        _id: genId,
        id: genId,
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
          console.error(`[Manager MongoDB] Async updateOne error in ${this.name}:`, err.message);
        });
    }

    return updated;
  }

  async findByIdAndUpdate(id, update) {
    const strId = String(id);
    const records = this.cache || [];
    const index = records.findIndex(item => String(item._id || item.id) === strId);

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
      this._mongoCol.updateOne(
        { $or: [{ _id: id }, { id: id }, { _id: strId }, { id: strId }] },
        { $set: { ...patch, updatedAt: new Date().toISOString() } }
      ).catch(err => {
        console.error(`[Manager MongoDB] Async findByIdAndUpdate error in ${this.name}:`, err.message);
      });
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
        console.error(`[Manager MongoDB] Async deleteOne error in ${this.name}:`, err.message);
      });
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
  users: new Collection('users', 'managers'),
  states: new Collection('states', 'states'),
  districts: new Collection('districts', 'districts'),
  divisions: new Collection('divisions', 'divisions'),
  pincodes: new Collection('pincodes', 'pincodes'),
  vendors: new Collection('vendors', 'vendors'),
  auditLogs: new Collection('audit_logs', 'auditlogs'),
  tasks: new Collection('tasks', 'tasks'),
  shopVisits: new Collection('shop_visits', 'fieldvisits'),
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
      console.log('✅ [Manager Database] All Manager collections linked to MongoDB Atlas.');
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


