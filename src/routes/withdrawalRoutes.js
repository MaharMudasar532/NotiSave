const express = require('express');
const { getWorldwideWithdrawals, seedWithdrawals } = require('../controllers/withdrawalController');

const router = express.Router();

router.get('/worldwide', getWorldwideWithdrawals);
router.post('/seed', seedWithdrawals);

module.exports = router;
