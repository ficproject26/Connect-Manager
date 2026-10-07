const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const { authLimiter, otpLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

// Public auth routes with rate limiting protection
router.post('/login', authLimiter, authController.login);
router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/register', authLimiter, authController.register);
router.get('/locations', authController.getRegistrationLocations);
router.get('/check-capacity', authController.checkCapacity);
router.post('/simulate-approval', authLimiter, authController.simulateApproval);
router.post('/simulate-kyc', authLimiter, authController.simulateKyc);
router.post('/upload-avatar', uploadLimiter, upload.single('avatar'), authController.uploadAvatar);
router.post('/upload-document', uploadLimiter, upload.single('document'), authController.uploadDocument);

router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected auth routes
router.get('/me', authMiddleware, authController.getMe);
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
