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
router.get('/registration-status/:userId', authController.getRegistrationStatus);
router.post('/subadmin-approval', authLimiter, authController.subAdminApproval);
router.post('/mainadmin-approval', authLimiter, authController.mainAdminApproval);
router.post('/kyc-approval', authLimiter, authController.kycApproval);
router.post('/upload-avatar', uploadLimiter, upload.single('avatar'), authController.uploadAvatar);
router.post('/upload-document', uploadLimiter, upload.single('document'), authController.uploadDocument);

router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected auth routes
router.get('/me', authMiddleware, authController.getMe);
router.post('/refresh', authMiddleware, authController.refreshToken);
router.put('/change-password', authMiddleware, authController.changePassword);
router.put('/bank-details', authMiddleware, authController.updateBankDetails);
router.put('/profile-photo', authMiddleware, uploadLimiter, upload.any(), authController.updateProfilePhoto);
router.post('/profile-photo', authMiddleware, uploadLimiter, upload.any(), authController.updateProfilePhoto);
router.delete('/profile-photo', authMiddleware, authController.removeProfilePhoto);

module.exports = router;
