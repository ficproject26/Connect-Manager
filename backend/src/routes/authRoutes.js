const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkRole, requireApprovalPermission } = require('../middleware/roleMiddleware');
const { upload, documentUpload, logoUpload } = require('../middleware/uploadMiddleware');

const { authLimiter, otpLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

// Public auth routes with rate limiting protection
router.post('/login', authLimiter, authController.login);
router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/register', authLimiter, authController.register);
router.get('/locations', authController.getRegistrationLocations);
router.get('/check-capacity', authController.checkCapacity);
router.get('/registration-status/:userId', authController.getRegistrationStatus);

// Registration KYC and Avatar upload during registration (rate limited)
router.post('/upload-avatar', uploadLimiter, upload.single('avatar'), authController.uploadAvatar);
router.post('/upload-document', uploadLimiter, documentUpload.any(), authController.uploadDocument);

// Password recovery routes
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Strict Multi-Stage Approval Routes (Require Authenticated Reviewer with Authorized Role)
router.post('/subadmin-approval', authLimiter, authMiddleware, requireApprovalPermission('subadmin'), authController.subAdminApproval);
router.post('/mainadmin-approval', authLimiter, authMiddleware, requireApprovalPermission('mainadmin'), authController.mainAdminApproval);
router.post('/kyc-approval', authLimiter, authMiddleware, requireApprovalPermission('kyc'), authController.kycApproval);

// Protected session validation route (accessible to authenticated users to check approval status)
router.get('/me', authMiddleware, authController.getMe);

// Protected operational manager routes (Require Approved Manager Role)
router.post('/refresh', authMiddleware, checkRole(), authController.refreshToken);
router.put('/change-password', authMiddleware, checkRole(), authController.changePassword);
router.get('/bank-details', authMiddleware, checkRole(), authController.getBankDetails);
router.put('/bank-details', authMiddleware, checkRole(), authController.updateBankDetails);
router.put('/profile-photo', authMiddleware, checkRole(), uploadLimiter, upload.any(), authController.updateProfilePhoto);
router.post('/profile-photo', authMiddleware, checkRole(), uploadLimiter, upload.any(), authController.updateProfilePhoto);
router.delete('/profile-photo', authMiddleware, checkRole(), authController.removeProfilePhoto);
router.delete('/profile-image', authMiddleware, checkRole(), authController.removeProfilePhoto);
router.delete('/avatar', authMiddleware, checkRole(), authController.removeProfilePhoto);
router.post('/remove-profile-photo', authMiddleware, checkRole(), authController.removeProfilePhoto);
router.post('/profile-photo/remove', authMiddleware, checkRole(), authController.removeProfilePhoto);

module.exports = router;
