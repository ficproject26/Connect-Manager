const { uploadToS3 } = require('../config/s3');
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
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

const { upload, logoUpload, documentUpload, documentUploadFields, logoUploadFields } = require('../middleware/uploadMiddleware');

// Handler for document, KYC file, and business image uploads
const handleDocumentUpload = (req, res) => {
  documentUploadFields(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Business document / KYC document / Business image must not exceed 5MB.'
        : err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many files uploaded in a single request.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Unexpected upload field '${err.field || 'unknown'}'. Expected 'document' or 'file'.`
        : (err.message || 'File upload rejected due to validation failure.');
      return res.status(400).json({
        success: false,
        message
      });
    }

    try {
      const file = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files && typeof req.files === 'object' ? Object.values(req.files).flat()[0] : null));
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const safeOriginalName = path.basename(file.originalname || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const mime = (file.mimetype || '').toLowerCase();
      let targetFolder = 'manager_docs';
      if (mime.startsWith('audio/') || file.originalname.match(/\.(webm|mp3|wav|m4a|ogg)$/i)) {
        targetFolder = 'voice_notes';
      } else if (mime.startsWith('image/')) {
        targetFolder = 'manager_images';
      }

      const s3Result = await uploadToS3(file.buffer || file.path, targetFolder, file.originalname);
      const fileUrl = s3Result.url;

      res.json({
        success: true,
        message: 'File uploaded successfully to AWS S3',
        file: {
          name: safeOriginalName,
          filename: s3Result.key,
          key: s3Result.key,
          url: fileUrl,
          secure_url: fileUrl,
          size: file.size,
          type: file.mimetype
        }
      });
    } catch (routeErr) {
      console.error('File upload to S3 route error:', routeErr);
      res.status(500).json({ success: false, message: routeErr.message || 'File upload processing failed.' });
    }
  });
};

// POST /api/uploads/document, /api/uploads/business-image, /api/uploads/storefront-photo
router.post('/document', handleDocumentUpload);
router.post('/business-image', handleDocumentUpload);
router.post('/storefront-photo', handleDocumentUpload);

// POST /api/uploads/avatar, /api/uploads/photo, /api/uploads/profile-photo, /api/uploads/logo
const handleAvatarUpload = (req, res) => {
  logoUploadFields(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Shop logo must not exceed 2MB.'
        : err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many files uploaded in a single request.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Unexpected upload field '${err.field || 'unknown'}'. Expected 'logo', 'avatar', 'photo', or 'file'.`
        : (err.message || 'Avatar upload rejected due to validation failure.');
      return res.status(400).json({
        success: false,
        message
      });
    }

    try {
      const file = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files && typeof req.files === 'object' ? Object.values(req.files).flat()[0] : null));
      if (!file) {
        return res.status(400).json({ success: false, message: 'No image file uploaded.' });
      }

      // If client sent multiple file parts (e.g. aliased field names), remove the duplicate files from disk
      if (req.files && req.files.length > 1) {
        for (let i = 1; i < req.files.length; i++) {
          try {
            if (req.files[i]?.path && fs.existsSync(req.files[i].path)) {
              fs.unlinkSync(req.files[i].path);
            }
          } catch (_) {}
        }
      }

      const s3Result = await uploadToS3(file.buffer || file.path, 'manager_avatars', file.originalname);
      const fileUrl = s3Result.url;

      res.json({
        success: true,
        message: 'Profile photo uploaded successfully',
        avatarUrl: fileUrl,
        file: {
          name: file.originalname,
          filename: s3Result.key,
          key: s3Result.key,
          url: fileUrl,
          secure_url: fileUrl,
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
router.post('/logo', handleAvatarUpload);
router.post('/shop-logo', handleAvatarUpload);

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

router.delete('/file', authMiddleware, checkRole(), handleFileDelete);
router.delete('/document', authMiddleware, checkRole(), handleFileDelete);

const authController = require('../controllers/authController');
router.delete('/profile-photo', authMiddleware, checkRole(), authController.removeProfilePhoto);
router.delete('/avatar', authMiddleware, checkRole(), authController.removeProfilePhoto);

module.exports = router;


