const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Strict extension to MIME type allowlist
const ALLOWED_EXTENSIONS_MAP = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.webm': ['audio/webm', 'video/webm'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.ogg': ['audio/ogg', 'application/ogg'],
  '.m4a': ['audio/mp4', 'audio/x-m4a']
};

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.vbs', '.scr',
  '.dll', '.com', '.jar', '.py', '.rb', '.pl', '.cgi', '.asp', '.aspx', '.jsp'
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // 1. Sanitize original filename and check for null bytes / path traversal
  const rawName = file.originalname || '';
  if (rawName.includes('\0') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
    return cb(new Error('Invalid filename. Path traversal characters detected.'));
  }

  const ext = path.extname(rawName).toLowerCase();

  // 2. Reject blocked dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Violation: File extension '${ext}' is not permitted.`));
  }

  // 3. Strict extension allowlist
  const validMimes = ALLOWED_EXTENSIONS_MAP[ext];
  if (!validMimes) {
    return cb(new Error('Invalid file type. Only PDF, JPG, PNG, WEBP, and safe audio files are accepted.'));
  }

  // 4. Verify MIME type matches extension
  const mime = (file.mimetype || '').toLowerCase();
  if (!validMimes.includes(mime)) {
    return cb(new Error(`MIME type mismatch: Content-Type '${mime}' does not match extension '${ext}'.`));
  }

  cb(null, true);
};

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

const logoFileFilter = (req, file, cb) => {
  const rawName = file.originalname || '';
  if (rawName.includes('\0') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
    return cb(new Error('Invalid filename. Path traversal characters detected.'));
  }
  const ext = path.extname(rawName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Violation: File extension '${ext}' is not permitted.`));
  }
  if (!imageExtensions.includes(ext)) {
    return cb(new Error('Invalid logo file type. Only JPG, PNG, and WEBP image files are accepted.'));
  }
  cb(null, true);
};

const documentFileFilter = (req, file, cb) => {
  const rawName = file.originalname || '';
  if (rawName.includes('\0') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
    return cb(new Error('Invalid filename. Path traversal characters detected.'));
  }
  const ext = path.extname(rawName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Violation: File extension '${ext}' is not permitted.`));
  }
  const validDocs = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.webm', '.mp3', '.wav', '.m4a', '.ogg', '.aac', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
  if (!validDocs.includes(ext)) {
    return cb(new Error('Invalid document file type. Only PDF, JPG, PNG, and WEBP documents are accepted.'));
  }
  const validMimes = ALLOWED_EXTENSIONS_MAP[ext];
  const mime = (file.mimetype || '').toLowerCase();
  if (!validMimes || !validMimes.includes(mime)) {
    return cb(new Error(`MIME type mismatch: Content-Type '${mime}' does not match extension '${ext}'.`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB default limit
    files: 5 // Allow field aliases or small batches while enforcing strict reasonable limit
  },
  fileFilter
});

const logoUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for shop/brand logos and profile photos
    files: 5
  },
  fileFilter: logoFileFilter
});

const documentUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for business licenses, KYC documents
    files: 5
  },
  fileFilter: documentFileFilter
});

const avatarUploadFields = upload.any();
const logoUploadFields = logoUpload.any();
const documentUploadFields = documentUpload.any();

module.exports = upload;
module.exports.upload = upload;
module.exports.logoUpload = logoUpload;
module.exports.documentUpload = documentUpload;
module.exports.avatarUploadFields = avatarUploadFields;
module.exports.logoUploadFields = logoUploadFields;
module.exports.documentUploadFields = documentUploadFields;
