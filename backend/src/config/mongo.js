const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

let client = null;
let db = null;

async function getMongoDb() {
  if (db) return db;
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    throw new Error('CRITICAL CONFIGURATION ERROR: MONGODB_URI environment variable is required in production.');
  }
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_manager_fresh?retryWrites=true&w=majority';
  const targetDbName = process.env.DB_NAME || (uri.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/) ? uri.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/)[1] : 'connect_manager_fresh');

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
    db = client.db(targetDbName);
    return db;
  } catch (err) {
    console.error('[Manager MongoDB] Atlas connection error:', err.message);
    throw err;
  }
}

module.exports = { getMongoDb };
