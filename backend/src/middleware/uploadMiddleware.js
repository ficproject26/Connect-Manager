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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate secure, unguessable random filename preserving only sanitized extension
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = Object.keys(ALLOWED_EXTENSIONS_MAP).includes(ext) ? ext : '.bin';
    const randomName = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${safeExt}`;
    cb(null, randomName);
  }
});

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

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit per file
    files: 1
  },
  fileFilter
});

module.exports = upload;
