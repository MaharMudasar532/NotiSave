const express = require('express');
const { ingestDeviceNotification } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/device', requireAuth, ingestDeviceNotification);

module.exports = router;
