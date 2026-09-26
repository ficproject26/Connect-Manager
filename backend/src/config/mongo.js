const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

let client = null;
let db = null;

async function getMongoDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect-app:Connect123@cluster0.fzj1k5l.mongodb.net/test?retryWrites=true&w=majority';
  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 8000,
        maxIdleTimeMS: 15000
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
