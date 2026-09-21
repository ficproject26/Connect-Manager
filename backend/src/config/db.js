const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Collection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  _read() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content || '[]');
    } catch (err) {
      console.error(`Error reading collection ${this.name}:`, err);
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async find(query = {}) {
    const records = this._read();
    return records.filter(item => {
      for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const records = this._read();
    return records.find(item => {
      for (const [key, val] of Object.entries(query)) {
        if (val === undefined || val === null) continue;
        if (item[key] !== val) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    const records = this._read();
    return records.find(item => item._id === id || item.id === id) || null;
  }

  async insertOne(doc) {
    const records = this._read();
    const newDoc = {
      _id: doc._id || uuidv4(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString()
    };
    records.push(newDoc);
    this._write(records);
    return newDoc;
  }

  async insertMany(docs) {
    const records = this._read();
    const newDocs = docs.map(doc => ({
      _id: doc._id || uuidv4(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString()
    }));
    records.push(...newDocs);
    this._write(records);
    return newDocs;
  }

  async updateOne(query, update) {
    const records = this._read();
    const index = records.findIndex(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    if (index === -1) return null;

    const current = records[index];
    const updated = {
      ...current,
      ...(update.$set ? update.$set : update),
      updatedAt: new Date().toISOString()
    };

    records[index] = updated;
    this._write(records);
    return updated;
  }

  async findByIdAndUpdate(id, update) {
    return this.updateOne({ _id: id }, update);
  }

  async deleteOne(query) {
    const records = this._read();
    const filtered = records.filter(item => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] === val) return false;
      }
      return true;
    });
    this._write(filtered);
    return { deletedCount: records.length - filtered.length };
  }

  async count(query = {}) {
    const items = await this.find(query);
    return items.length;
  }

  async clear() {
    this._write([]);
  }
}

const db = {
  users: new Collection('users'),
  states: new Collection('states'),
  districts: new Collection('districts'),
  divisions: new Collection('divisions'),
  pincodes: new Collection('pincodes'),
  vendors: new Collection('vendors'),
  auditLogs: new Collection('audit_logs')
};

module.exports = db;
