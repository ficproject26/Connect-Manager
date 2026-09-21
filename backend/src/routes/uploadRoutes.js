const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(checkRole());

// POST /api/uploads/document
router.post('/document', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

module.exports = router;
