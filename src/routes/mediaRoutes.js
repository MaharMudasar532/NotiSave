const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/mediaController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/image', requireAuth, upload.single('image'), uploadImage);

module.exports = router;
