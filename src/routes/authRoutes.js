const express = require('express');
const {
	getCurrentUser,
	getActiveReferrals,
	login,
	signup,
	startMining,
	updateBackupSettings,
	updateBankDetails,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/signup', signup);
router.get('/me', requireAuth, getCurrentUser);
router.get('/referrals/active', requireAuth, getActiveReferrals);
router.post('/mining/start', requireAuth, startMining);
router.put('/backup-settings', requireAuth, updateBackupSettings);
router.put('/bank-details', requireAuth, updateBankDetails);

module.exports = router;