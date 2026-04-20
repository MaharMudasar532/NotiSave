const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const generateReferralCode = require('../utils/generateReferralCode');
const {
  BASE_MINING_RATE,
  startMiningWindow,
  syncMiningState,
  syncReferralMiningRate,
} = require('../utils/mining');

const REFERRAL_REWARD_POINTS = 1000;

function buildUserPayload(user) {
  return {
    backupEnabled: Boolean(user.backupEnabled),
    bankDetails: user.bankDetails,
    email: user.email,
    id: user._id.toString(),
    mining: {
      active: Boolean(user.mining?.active),
      activatedAt: user.mining?.activatedAt ? new Date(user.mining.activatedAt).toISOString() : null,
      activeUntil: user.mining?.activeUntil ? new Date(user.mining.activeUntil).toISOString() : null,
      baseRate: user.mining?.baseRate ?? BASE_MINING_RATE,
      hourlyRate: user.mining?.hourlyRate ?? BASE_MINING_RATE,
      lastAccruedAt: user.mining?.lastAccruedAt ? new Date(user.mining.lastAccruedAt).toISOString() : null,
      referralBoostRate: user.mining?.referralBoostRate ?? 0,
      referralCount: user.mining?.referralCount ?? 0,
    },
    name: user.name,
    points: user.points,
    referralCode: user.referralCode,
    storage: {
      quotaBytes: user.storageQuotaBytes ?? 10 * 1024 * 1024 * 1024,
      usedBytes: user.storageUsedBytes ?? 0,
    },
    withdraw: user.withdraw,
  };
}

async function syncUserMiningProfile(user) {
  const referralCount = await User.countDocuments({ referredBy: user._id });
  const didSyncMining = syncMiningState(user);
  const didSyncRate = syncReferralMiningRate(user, referralCount);

  return didSyncMining || didSyncRate;
}

function createToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function deriveNameFromEmail(email) {
  const [localPart] = email.split('@');
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map(fragment => fragment[0].toUpperCase() + fragment.slice(1))
    .join(' ');
}

function formatFullName(firstName, lastName, email) {
  const joinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joinedName || deriveNameFromEmail(email);
}

async function signup(request, response, next) {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const firstName = String(request.body.firstName || '').trim();
    const lastName = String(request.body.lastName || '').trim();
    const password = String(request.body.password || '').trim();
    const incomingReferralCode = String(request.body.referralCode || '')
      .trim()
      .toUpperCase();

    if (!email || !password || !firstName || !lastName) {
      throw createHttpError(400, 'First name, last name, email, and password are required.');
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw createHttpError(409, 'An account with this email already exists.');
    }

    let referredByUser = null;

    if (incomingReferralCode) {
      referredByUser = await User.findOne({ referralCode: incomingReferralCode });

      if (!referredByUser) {
        throw createHttpError(404, 'Referral code was not found.');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const points = referredByUser ? REFERRAL_REWARD_POINTS : 0;
    const user = await User.create({
      email,
      mining: {
        active: false,
        activatedAt: null,
        activeUntil: null,
        baseRate: BASE_MINING_RATE,
        hourlyRate: BASE_MINING_RATE,
        lastAccruedAt: null,
        referralBoostRate: 0,
        referralCount: 0,
      },
      name: formatFullName(firstName, lastName, email),
      passwordHash,
      points,
      referralCode: await generateReferralCode(email),
      referredBy: referredByUser?._id ?? null,
      withdraw: false,
    });

    if (await syncUserMiningProfile(user)) {
      await user.save();
    }

    if (referredByUser) {
      referredByUser.points += REFERRAL_REWARD_POINTS;
      await syncUserMiningProfile(referredByUser);
      await referredByUser.save();
    }

    response.status(201).json({
      token: createToken(user._id.toString()),
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function login(request, response, next) {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = String(request.body.password || '').trim();

    if (!email || !password) {
      throw createHttpError(400, 'Email and password are required.');
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw createHttpError(401, 'Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw createHttpError(401, 'Invalid email or password.');
    }

    if (await syncUserMiningProfile(user)) {
      await user.save();
    }

    response.json({
      token: createToken(user._id.toString()),
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function updateBankDetails(request, response, next) {
  try {
    const bankName = String(request.body.bankName || '').trim();
    const accountTitle = String(request.body.accountTitle || '').trim();
    const accountNumber = String(request.body.accountNumber || '').trim();

    if (!bankName || !accountTitle || !accountNumber) {
      throw createHttpError(400, 'Bank name, account title, and account number are required.');
    }

    const user = await User.findById(request.authUserId);

    if (!user) {
      throw createHttpError(404, 'User not found.');
    }

    await syncUserMiningProfile(user);

    user.bankDetails = {
      accountNumber,
      accountTitle,
      bankName,
    };

    await user.save();

    response.json({
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function getCurrentUser(request, response, next) {
  try {
    const user = await User.findById(request.authUserId);

    if (!user) {
      throw createHttpError(404, 'User not found.');
    }

    if (await syncUserMiningProfile(user)) {
      await user.save();
    }

    response.json({
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function startMining(request, response, next) {
  try {
    const user = await User.findById(request.authUserId);

    if (!user) {
      throw createHttpError(404, 'User not found.');
    }

    await syncUserMiningProfile(user);
    startMiningWindow(user);
    await user.save();

    response.json({
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function updateBackupSettings(request, response, next) {
  try {
    const enabled = Boolean(request.body.enabled);
    const user = await User.findById(request.authUserId);

    if (!user) {
      throw createHttpError(404, 'User not found.');
    }

    user.backupEnabled = enabled;
    await user.save();

    response.json({
      user: buildUserPayload(user),
    });
  } catch (error) {
    next(error);
  }
}

async function getActiveReferrals(request, response, next) {
  try {
    const referrals = await User.find({
      referredBy: request.authUserId,
      'mining.active': true,
    })
      .sort({ createdAt: -1 })
      .select('name email createdAt points mining.active');

    response.json({
      referrals: referrals.map(referral => ({
        id: referral._id.toString(),
        name: referral.name,
        email: referral.email,
        joinedAt: referral.createdAt,
        points: referral.points,
        active: Boolean(referral.mining?.active),
      })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentUser,
  getActiveReferrals,
  login,
  signup,
  startMining,
  updateBackupSettings,
  updateBankDetails,
};