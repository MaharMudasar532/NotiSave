const express = require('express');
const {
	getMyDeviceNotifications,
	ingestDeviceNotification,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/mine', requireAuth, getMyDeviceNotifications);
router.post('/device', requireAuth, ingestDeviceNotification);

module.exports = router;
