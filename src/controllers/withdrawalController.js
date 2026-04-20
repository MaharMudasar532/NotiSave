const Withdrawal = require('../models/Withdrawal');
const { seedWithdrawalData } = require('../utils/seedWithdrawals');

async function getWorldwideWithdrawals(request, response, next) {
  try {
    const withdrawals = await Withdrawal.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');

    const formatted = withdrawals.map(wd => ({
      id: wd._id.toString(),
      amount: wd.amount,
      bankName: wd.bankDetails.bankName,
      status: wd.status,
      country: wd.country,
      userInitials: wd.userInitials,
      date: new Date(wd.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      createdAt: wd.createdAt,
    }));

    response.json({
      withdrawals: formatted,
    });
  } catch (error) {
    next(error);
  }
}

async function seedWithdrawals(request, response, next) {
  try {
    const result = await seedWithdrawalData();
    response.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getWorldwideWithdrawals,
  seedWithdrawals,
};
