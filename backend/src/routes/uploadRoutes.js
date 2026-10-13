const express = require('express');
const router = express.Router();
const path = require('path');
const upload = require('../middleware/uploadMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

const { uploadLimiter } = require('../middleware/rateLimitMiddleware');

// Optional auth: attach user if token provided, but allow file upload even if unauthenticated
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware(req, res, () => next());
  }
  next();
};

router.use(optionalAuth);
router.use(uploadLimiter);

// POST /api/uploads/document
router.post('/document', (req, res) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload rejected due to validation failure.'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const safeOriginalName = path.basename(req.file.originalname || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
          name: safeOriginalName,
          filename: req.file.filename,
          url: fileUrl,
          size: req.file.size,
          type: req.file.mimetype
        }
      });
    } catch (routeErr) {
      console.error('File upload route error:', routeErr);
      res.status(500).json({ success: false, message: 'File upload processing failed.' });
    }
  });
});

// POST /api/uploads/avatar, /api/uploads/photo, /api/uploads/profile-photo
const handleAvatarUpload = (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Avatar upload rejected due to validation failure.'
      });
    }

    try {
      const file = req.file || (req.files && req.files[0]);
      if (!file) {
        return res.status(400).json({ success: false, message: 'No image file uploaded.' });
      }

      const fileUrl = `/uploads/${file.filename}`;
      res.json({
        success: true,
        message: 'Profile photo uploaded successfully',
        avatarUrl: fileUrl,
        file: {
          name: file.originalname,
          filename: file.filename,
          url: fileUrl,
          size: file.size,
          type: file.mimetype
        }
      });
    } catch (routeErr) {
      console.error('Avatar upload route error:', routeErr);
      res.status(500).json({ success: false, message: 'Avatar upload processing failed.' });
    }
  });
};

router.post('/avatar', handleAvatarUpload);
router.post('/photo', handleAvatarUpload);
router.post('/profile-photo', handleAvatarUpload);

const fs = require('fs');
const db = require('../config/db');

// DELETE /api/uploads/file & /api/uploads/document - Secure file removal
const handleFileDelete = async (req, res) => {
  try {
    const rawTarget = req.body?.url || req.body?.filename || req.query?.url || req.query?.filename;
    if (!rawTarget || typeof rawTarget !== 'string') {
      return res.status(400).json({ success: false, message: 'File URL or filename is required.' });
    }

    // Explicit path traversal detection
    if (rawTarget.includes('..')) {
      return res.status(400).json({ success: false, message: 'Invalid file path: path traversal detected.' });
    }

    // Path traversal defense
    const filename = path.basename(rawTarget.trim());
    if (!filename || filename === '.' || filename === '..') {
      return res.status(400).json({ success: false, message: 'Invalid filename provided.' });
    }

    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
    const filePath = path.join(uploadsDir, filename);

    // Check if document is permanently locked by an approved/active vendor
    if (db.vendors) {
      const allVendors = await db.vendors.find().catch(() => []);
      const lockedVendor = (allVendors || []).find(v => {
        const isApproved = ['Approved', 'Active', 'Completed'].includes(v.status);
        if (!isApproved) return false;

        if (Array.isArray(v.documents)) {
          if (v.documents.some(d => String(d?.url || d?.name || '').includes(filename))) return true;
        }
        if (typeof v.businessLicense === 'string' && v.businessLicense.includes(filename)) return true;
        if (v.businessLicense?.url && String(v.businessLicense.url).includes(filename)) return true;
        if (typeof v.logo === 'string' && v.logo.includes(filename)) return true;
        if (v.logo?.url && String(v.logo.url).includes(filename)) return true;

        return false;
      });

      if (lockedVendor) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete document permanently associated with an approved vendor record.'
        });
      }
    }

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn('File unlink error:', unlinkErr.message);
      }
    }

    res.json({
      success: true,
      message: 'File removed successfully',
      filename
    });
  } catch (err) {
    console.error('File deletion error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete file from storage.' });
  }
};

router.delete('/file', handleFileDelete);
router.delete('/document', handleFileDelete);

module.exports = router;

