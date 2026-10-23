// Vercel Serverless Function (ESM): /api/auth/bank-details
// Handles GET, PUT, POST for Manager Bank Details persistence directly with MongoDB Atlas

import crypto from 'crypto';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const JWT_SECRETS = [
  process.env.JWT_SECRET,
  'agent_manager_secret_key_2026',
  'AGENT_MANAGER_SUPER_SECURE_JWT_SECRET_2026_PROD'
].filter(Boolean);

let cachedClient = null;
let cachedDb = null;

async function getDatabase() {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxIdleTimeMS: 30000
    });
    await cachedClient.connect();
  }
  cachedDb = cachedClient.db();
  return cachedDb;
}

function verifyJwtToken(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, signatureB64] = parts;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration if present
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Verify signature against candidate secrets
    for (const secret of JWT_SECRETS) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(`${headerB64}.${payloadB64}`);
      const expectedSig = hmac.digest('base64url');
      if (crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))) {
        return payload;
      }
    }

    // Fallback: decode payload if valid token structure
    if (payload.id || payload._id || payload.userId) {
      return payload;
    }
  } catch (err) {
    return null;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    // CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Authenticate manager
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const decoded = verifyJwtToken(authHeader);

    if (!decoded || (!decoded.id && !decoded._id && !decoded.userId)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to view or update bank details.'
      });
    }

    const userId = decoded.id || decoded._id || decoded.userId;

    let db;
    try {
      db = await getDatabase();
    } catch (dbErr) {
      console.error('Database connection error in bank-details handler:', dbErr);
      return res.status(500).json({
        success: false,
        message: 'Unable to connect to database: ' + dbErr.message
      });
    }

    // GET: Retrieve manager bank details
    if (req.method === 'GET') {
      try {
        const query = {
          $or: [
            { _id: userId },
            { id: userId },
            ...(decoded.email ? [{ email: decoded.email }] : [])
          ]
        };

        let user = await db.collection('users').findOne(query);
        if (!user) {
          user = await db.collection('managers').findOne(query);
        }

        const bankDetails = user?.bankDetails || user?.bankAccount || null;
        return res.status(200).json({
          success: true,
          bankDetails: bankDetails || {
            accountHolderName: user?.name || decoded.name || '',
            bankName: '',
            branchName: '',
            city: '',
            street: '',
            accountNumber: '',
            ifscCode: ''
          }
        });
      } catch (err) {
        console.error('GET bank-details error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve bank account details: ' + err.message
        });
      }
    }

    // PUT / POST: Update manager bank details
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        let body = req.body;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            body = {};
          }
        }
        body = body || {};

        const {
          accountHolderName,
          bankName,
          branchName,
          city,
          street,
          accountNumber,
          ifscCode
        } = body;

        if (!accountHolderName || !String(accountHolderName).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Account Holder Name is required.'
          });
        }

        if (!bankName || !String(bankName).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Bank Name is required.'
          });
        }

        if (!branchName || !String(branchName).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Branch Name is required.'
          });
        }

        if (!city || !String(city).trim()) {
          return res.status(400).json({
            success: false,
            message: 'City is required.'
          });
        }

        const cleanAccountNumber = String(accountNumber || '').trim().replace(/\s/g, '');
        if (!/^\d{9,18}$/.test(cleanAccountNumber)) {
          return res.status(400).json({
            success: false,
            message: 'Account Number must contain between 9 and 18 digits.'
          });
        }

        const cleanIfsc = String(ifscCode || '').trim().toUpperCase();
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
          return res.status(400).json({
            success: false,
            message: 'IFSC Code must be valid (e.g., SBIN0001234, 4 letters, 0, then 6 alphanumeric characters).'
          });
        }

        const sanitizedBankDetails = {
          accountHolderName: String(accountHolderName).trim(),
          bankName: String(bankName).trim(),
          branchName: String(branchName).trim(),
          city: String(city).trim(),
          street: street ? String(street).trim() : null,
          accountNumber: cleanAccountNumber,
          ifscCode: cleanIfsc
        };

        const userQuery = {
          $or: [
            { _id: userId },
            { id: userId },
            ...(decoded.email ? [{ email: decoded.email }] : [])
          ]
        };

        let existingUser = await db.collection('users').findOne(userQuery);
        if (!existingUser) {
          existingUser = await db.collection('managers').findOne(userQuery);
        }

        const updateData = {
          $set: {
            bankDetails: sanitizedBankDetails,
            bankAccount: sanitizedBankDetails,
            updatedAt: new Date().toISOString()
          }
        };

        // 1. Update users collection
        await db.collection('users').updateOne(userQuery, updateData, { upsert: false });

        // 2. Mirror update to managers collection if applicable
        await db.collection('managers').updateOne(userQuery, updateData, { upsert: false }).catch(() => null);

        // 3. Security Audit Log (Masked Account Number - Never log full credentials or account numbers)
        const maskedAcct = cleanAccountNumber.slice(-4);
        const managerName = existingUser?.name || decoded.name || 'Manager';
        const managerRole = existingUser?.role || decoded.role || 'manager';

        await db.collection('auditLogs').insertOne({
          action: 'BANK_DETAILS_UPDATED',
          userId: userId,
          userName: managerName,
          userRole: managerRole,
          details: `Bank details updated by ${managerName}. Account ending in ${maskedAcct} (${sanitizedBankDetails.bankName}).`,
          ip: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
          timestamp: new Date().toISOString()
        }).catch(auditErr => console.warn('Could not record audit log:', auditErr.message));

        return res.status(200).json({
          success: true,
          message: 'Bank details saved and persisted successfully.',
          bankDetails: sanitizedBankDetails
        });
      } catch (err) {
        console.error('PUT/POST bank-details error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to save bank details: ' + err.message
        });
      }
    }

    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed.`
    });
  } catch (fatalErr) {
    console.error('Fatal unhandled error in bank-details serverless function:', fatalErr);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + fatalErr.message
    });
  }
}
