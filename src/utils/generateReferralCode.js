const User = require('../models/User');

async function generateReferralCode(email) {
  const prefix = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase()
    .padEnd(4, 'X');

  while (true) {
    const randomChunk = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `${prefix}-${randomChunk}`;
    const existingUser = await User.findOne({ referralCode });

    if (!existingUser) {
      return referralCode;
    }
  }
}

module.exports = generateReferralCode;