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
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/test?retryWrites=true&w=majority';
  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        maxIdleTimeMS: 60000,
        minPoolSize: 5,
        maxPoolSize: 50,
        waitQueueTimeoutMS: 5000
      });
      await client.connect();
    }
    db = client.db();
    return db;
  } catch (err) {
    console.warn('[Manager MongoDB] Atlas connection error:', err.message);
    return null;
  }
}

module.exports = { getMongoDb };
