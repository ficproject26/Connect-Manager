const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { getMongoDb, getDatabaseName, TARGET_DB_NAME } = require('./mongo');
const eventPublisher = require('../events/eventPublisher');

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

    if (['_id', 'id', 'userId', 'managerId', 'stateId', 'districtId', 'divisionId', 'pincodeId'].includes(k) && typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) {
      sanitized[k] = { $in: [new ObjectId(v), v] };
    } else if (v instanceof ObjectId) {
      sanitized[k] = v;
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
    this._mongoCol = null;
    this._mongoDb = null;
    this._isReady = false;
  }

  async initMongo(mongoDb) {
    if (!mongoDb) return;
    this._mongoDb = mongoDb;
    this._mongoCol = mongoDb.collection(this.mongoName);
    this._isReady = true;
  }

  async _ensureReady() {
    if (!this._mongoCol) {
      await initDatabase();
    }
    if (!this._mongoCol) {
      throw new Error(`Database connection not initialized: Collection '${this.name}' is unavailable.`);
    }
  }

  async find(query = {}, options = {}) {
    try {
      await this._ensureReady();
      const cleanQuery = sanitizeQuery(query);
      const findOptions = { maxTimeMS: 15000, ...options };
      if ((this.mongoName === 'users' || this.mongoName === 'agents') && !options.projection) {
        findOptions.projection = { kycDocs: 0, kyc: 0 };
      }

      const docs = await this._mongoCol.find(cleanQuery, findOptions).toArray();
      return docs || [];
    } catch (e) {
      console.warn(`[Manager Database] find unavailable for '${this.name}':`, e.message);
      return [];
    }
  }

  async findOne(query = {}, options = {}) {
    try {
      await this._ensureReady();
      const cleanQuery = sanitizeQuery(query);
      const findOptions = { ...options };
      if ((this.mongoName === 'users' || this.mongoName === 'agents') && !options.projection) {
        findOptions.projection = { kycDocs: 0, kyc: 0 };
      }

      const doc = await this._mongoCol.findOne(cleanQuery, findOptions);
      return doc || null;
    } catch (e) {
      console.warn(`[Manager Database] findOne unavailable for '${this.name}':`, e.message);
      return null;
    }
  }

  async findById(id, options = {}) {
    if (!id) return null;
    try {
      await this._ensureReady();
      const strId = String(id);
      const orConditions = [{ _id: id }, { id: id }, { _id: strId }, { id: strId }];
      if (/^[0-9a-fA-F]{24}$/.test(strId)) {
        try {
          orConditions.push({ _id: new ObjectId(strId) });
        } catch (e) {}
      }

      const findOptions = { ...options };
      if ((this.mongoName === 'users' || this.mongoName === 'agents') && !options.projection) {
        findOptions.projection = { kycDocs: 0, kyc: 0 };
      }

      const doc = await this._mongoCol.findOne({ $or: orConditions }, findOptions);
      return doc || null;
    } catch (e) {
      console.warn(`[Manager Database] findById unavailable for '${this.name}':`, e.message);
      return null;
    }
  }

  async insertOne(doc) {
    await this._ensureReady();
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

    // Write directly to MongoDB and await completion
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
      ).catch(e => console.warn('[Manager MongoDB] Sync to managers warning:', e.message));
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
    if (!docs || !Array.isArray(docs) || docs.length === 0) return [];
    await this._ensureReady();
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

    // Write directly to MongoDB and await completion
    await Promise.all(newDocs.map(d =>
      this._mongoCol.updateOne(
        { $or: [{ _id: d._id }, { id: d.id }] },
        { $set: d },
        { upsert: true }
      )
    ));

    return newDocs;
  }

  async updateOne(query, update) {
    await this._ensureReady();
    const cleanQuery = sanitizeQuery(query);
    const patch = update.$set ? update.$set : update;
    const updatePayload = {
      $set: {
        ...patch,
        updatedAt: new Date().toISOString()
      }
    };

    const res = await this._mongoCol.updateOne(cleanQuery, updatePayload);
    if (res.matchedCount === 0) {
      return null;
    }

    if (this.name === 'users' && this._mongoDb) {
      await this._mongoDb.collection('managers').updateOne(cleanQuery, updatePayload).catch(() => {});
    }

    return await this.findOne(cleanQuery);
  }

  async updateMany(query, update) {
    await this._ensureReady();
    const cleanQuery = sanitizeQuery(query);
    const patch = update.$set ? update.$set : update;
    const updatePayload = {
      $set: {
        ...patch,
        updatedAt: new Date().toISOString()
      }
    };
    return await this._mongoCol.updateMany(cleanQuery, updatePayload);
  }

  async findByIdAndUpdate(id, update) {
    if (!id) return null;
    await this._ensureReady();
    const strId = String(id);
    const patch = update.$set ? update.$set : update;
    const orConditions = [{ _id: id }, { id: id }, { _id: strId }, { id: strId }];
    if (/^[0-9a-fA-F]{24}$/.test(strId)) {
      try {
        orConditions.push({ _id: new ObjectId(strId) });
      } catch (e) {}
    }

    const updatePayload = {
      $set: {
        ...patch,
        updatedAt: new Date().toISOString()
      }
    };

    await this._mongoCol.updateOne({ $or: orConditions }, updatePayload);

    if (this.name === 'users' && this._mongoDb) {
      await this._mongoDb.collection('managers').updateOne({ $or: orConditions }, updatePayload).catch(() => {});
    }

    const updated = await this.findById(id);

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
    await this._ensureReady();
    const cleanQuery = sanitizeQuery(query);
    const res = await this._mongoCol.deleteOne(cleanQuery);
    if (this.name === 'users' && this._mongoDb) {
      await this._mongoDb.collection('managers').deleteOne(cleanQuery).catch(() => {});
    }
    return { deletedCount: res.deletedCount || 0 };
  }

  async deleteMany(query = {}) {
    await this._ensureReady();
    const cleanQuery = sanitizeQuery(query);
    const res = await this._mongoCol.deleteMany(cleanQuery);
    if (this.name === 'users' && this._mongoDb) {
      await this._mongoDb.collection('managers').deleteMany(cleanQuery).catch(() => {});
    }
    return { deletedCount: res.deletedCount || 0 };
  }

  async count(query = {}) {
    await this._ensureReady();
    const cleanQuery = sanitizeQuery(query);
    return await this._mongoCol.countDocuments(cleanQuery);
  }

  async clear() {
    await this._ensureReady();
    await this._mongoCol.deleteMany({});
    if (this.name === 'users' && this._mongoDb) {
      await this._mongoDb.collection('managers').deleteMany({}).catch(() => {});
    }
  }
}

const staticCollections = {
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
  settings: new Collection('settings', 'settings'),
  tickets: new Collection('tickets', 'tickets'),
  securitySessions: new Collection('security_sessions', 'securitysessions'),
  kycRecords: new Collection('kyc_records', 'kyc_records'),
  managerrequests: new Collection('managerrequests', 'managerrequests'),
  otpverifications: new Collection('otpverifications', 'otpverifications')
};

let activeMongoDb = null;

// Proxy handler to allow dynamic collection access for any unforeseen collection
const db = new Proxy(staticCollections, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    if (typeof prop === 'string' && prop !== 'then' && prop !== 'inspect' && prop !== 'nodeType') {
      const col = new Collection(prop, prop.toLowerCase());
      if (activeMongoDb) {
        col.initMongo(activeMongoDb);
      }
      target[prop] = col;
      return col;
    }
    return target[prop];
  }
});

let initPromise = null;

async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mongoDb = await getMongoDb();
      if (!mongoDb) {
        throw new Error('Could not connect to MongoDB Atlas instance.');
      }
      activeMongoDb = mongoDb;

      const collections = Object.values(staticCollections).filter(c => c && typeof c.initMongo === 'function');
      await Promise.all(collections.map(col => col.initMongo(mongoDb)));

      console.log(`✅ [Manager Database] Connected directly to MongoDB '${mongoDb.databaseName}' as single source of truth.`);

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
          mongoDb.collection('vendors').createIndex({ districtId: 1, status: 1 }),
          mongoDb.collection('vendors').createIndex({ divisionId: 1, status: 1 }),
          mongoDb.collection('vendors').createIndex({ pincode: 1 }),
          mongoDb.collection('vendors').createIndex({ registrationId: 1 }),
          mongoDb.collection('tasks').createIndex({ status: 1, createdAt: -1 }),
          mongoDb.collection('tasks').createIndex({ assignedTo: 1 }),
          mongoDb.collection('tasks').createIndex({ assignedManagerId: 1, status: 1 }),
          mongoDb.collection('agents').createIndex({ status: 1 }),
          mongoDb.collection('notifications').createIndex({ userId: 1, isRead: 1 }),
          mongoDb.collection('pincodes').createIndex({ code: 1 }),
          mongoDb.collection('districts').createIndex({ stateId: 1 }),
          mongoDb.collection('divisions').createIndex({ districtId: 1 }),
          mongoDb.collection('manageronboardings').createIndex({ managerId: 1, status: 1 }),
          mongoDb.collection('manageronboardings').createIndex({ pincodeId: 1, status: 1 }),
          mongoDb.collection('auditlogs').createIndex({ createdAt: -1 }),
          mongoDb.collection('fieldvisits').createIndex({ vendorId: 1 })
        ]);
        console.log('⚡ [Manager Database] Performance indexes verified in MongoDB Atlas.');
      } catch (idxErr) {
        console.warn('[Manager Database] Index creation warning:', idxErr.message);
      }



      return true;
    } catch (err) {
      initPromise = null;
      console.error('❌ [Manager Database] MongoDB initialization error:', err.message);
      throw err;
    }
  })();

  return initPromise;
}

db.initDatabase = initDatabase;
db.getDatabaseName = getDatabaseName;
module.exports = db;

