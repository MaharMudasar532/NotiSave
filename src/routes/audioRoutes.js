const express = require('express');
const multer = require('multer');
const { uploadDailyAudio } = require('../controllers/audioController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/daily', requireAuth, upload.single('audio'), uploadDailyAudio);

module.exports = router;
