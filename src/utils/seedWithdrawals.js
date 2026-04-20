const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');

const SEED_COUNTRIES = [
  'Pakistan',
  'India',
  'Bangladesh',
  'UAE',
  'Saudi Arabia',
  'Egypt',
  'Nigeria',
  'Philippines',
  'Indonesia',
  'Turkey',
];

const SEED_BANK_NAMES = [
  'HBL',
  'UBL',
  'Habib Bank',
  'ICICI',
  'HDFC',
  'Standard Chartered',
  'Emirates NBD',
  'Al Rajhi',
  'Access Bank',
  'BDO',
];

async function seedWithdrawalData() {
  try {
    const existingCount = await Withdrawal.countDocuments();
    if (existingCount > 0) {
      return { message: 'Withdrawal data already seeded', count: existingCount };
    }

    const users = await User.find().limit(10);
    if (users.length === 0) {
      return { message: 'No users found for seeding withdrawals' };
    }

    const withdrawals = [];
    const statuses = ['Pending', 'Approved', 'Rejected'];

    for (let i = 0; i < 20; i += 1) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomCountry = SEED_COUNTRIES[Math.floor(Math.random() * SEED_COUNTRIES.length)];
      const randomBank = SEED_BANK_NAMES[Math.floor(Math.random() * SEED_BANK_NAMES.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const userInitials = randomUser.name
        .split(' ')
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('');

      withdrawals.push({
        userId: randomUser._id,
        amount: Math.floor(Math.random() * 500) + 50,
        bankDetails: {
          accountNumber: String(Math.floor(Math.random() * 100000000000)),
          accountTitle: randomUser.name,
          bankName: randomBank,
        },
        status: randomStatus,
        country: randomCountry,
        userInitials,
      });
    }

    const created = await Withdrawal.insertMany(withdrawals);
    return { message: 'Withdrawal data seeded successfully', count: created.length };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  seedWithdrawalData,
};
