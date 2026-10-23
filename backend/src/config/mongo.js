const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Robust environment loading across PM2, cwd, root, and backend paths
const candidateEnvPaths = [
  path.join(__dirname, '..', '..', '.env'),
  path.join(__dirname, '..', '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env')
];

candidateEnvPaths.forEach(p => {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
});

function resolveDatabaseName(uri) {
  if (process.env.DB_NAME) return process.env.DB_NAME;
  if (uri) {
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/);
    if (match && match[1]) return match[1];
  }
  return undefined;
}

let client = null;
let db = null;

function resolveMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI;
}

async function getMongoDb() {
  if (db) return db;

  const uri = resolveMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 60000,
        minPoolSize: 1,
        maxPoolSize: 30
      });
      await client.connect();
    }

    const targetDb = resolveDatabaseName(uri);
    db = targetDb ? client.db(targetDb) : client.db();
    console.log(`✅ [Manager MongoDB] Successfully selected database: '${db.databaseName}'.`);
    return db;
  } catch (err) {
    console.error('[Manager MongoDB] Atlas connection error:', err.message);
    throw err;
  }
}

function getDatabaseName() {
  return db ? db.databaseName : (process.env.DB_NAME || 'default');
}

function getMongoClient() {
  return client;
}

module.exports = {
  getMongoDb,
  getDatabaseName,
  getMongoClient
};
