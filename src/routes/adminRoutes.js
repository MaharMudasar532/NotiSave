const express = require('express');
const {
  adminLogin,
  getAdminUsers,
  getUserNotifications,
  playRecording,
  viewImage,
} = require('../controllers/adminController');
const { requireAdminAuth } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/users', requireAdminAuth, getAdminUsers);
router.get('/users/:userId/notifications', requireAdminAuth, getUserNotifications);
router.get('/recordings/:recordingId/play', requireAdminAuth, playRecording);
router.get('/images/:imageId/view', requireAdminAuth, viewImage);

module.exports = router;
