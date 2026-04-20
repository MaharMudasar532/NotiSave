const BASE_MINING_RATE = 0.005;
const REFERRAL_RATE_STEP = 0.005;
const MINING_WINDOW_HOURS = 24;

function toRate(value) {
  return Number(value.toFixed(3));
}

function calculateReferralBoostRate(referralCount) {
  return toRate(Math.max(0, referralCount) * REFERRAL_RATE_STEP);
}

function calculateMiningRate(referralCount) {
  return toRate(BASE_MINING_RATE + calculateReferralBoostRate(referralCount));
}

function ensureMiningState(user) {
  if (!user.mining) {
    user.mining = {
      active: false,
      activatedAt: null,
      activeUntil: null,
      baseRate: BASE_MINING_RATE,
      hourlyRate: BASE_MINING_RATE,
      lastAccruedAt: null,
      referralBoostRate: 0,
      referralCount: 0,
    };
  }

  if (!user.mining.baseRate) {
    user.mining.baseRate = BASE_MINING_RATE;
  }

  if (typeof user.mining.referralBoostRate !== 'number') {
    user.mining.referralBoostRate = 0;
  }

  if (typeof user.mining.referralCount !== 'number') {
    user.mining.referralCount = 0;
  }

  if (!user.mining.hourlyRate) {
    user.mining.hourlyRate = calculateMiningRate(user.mining.referralCount);
  }

  return user.mining;
}

function syncReferralMiningRate(user, referralCount) {
  const mining = ensureMiningState(user);
  const safeReferralCount = Math.max(0, referralCount);
  const nextBoostRate = calculateReferralBoostRate(safeReferralCount);
  const nextRate = calculateMiningRate(safeReferralCount);
  let hasChanged = false;

  if (mining.baseRate !== BASE_MINING_RATE) {
    mining.baseRate = BASE_MINING_RATE;
    hasChanged = true;
  }

  if (mining.referralCount !== safeReferralCount) {
    mining.referralCount = safeReferralCount;
    hasChanged = true;
  }

  if (mining.referralBoostRate !== nextBoostRate) {
    mining.referralBoostRate = nextBoostRate;
    hasChanged = true;
  }

  if (mining.hourlyRate !== nextRate) {
    mining.hourlyRate = nextRate;
    hasChanged = true;
  }

  return hasChanged;
}

function syncMiningState(user) {
  const mining = ensureMiningState(user);

  if (!mining.active || !mining.activeUntil || !mining.lastAccruedAt) {
    return false;
  }

  const now = new Date();
  const activeUntil = new Date(mining.activeUntil);
  const lastAccruedAt = new Date(mining.lastAccruedAt);
  const accrualEnd = now < activeUntil ? now : activeUntil;
  let hasChanged = false;

  if (accrualEnd.getTime() > lastAccruedAt.getTime()) {
    const elapsedHours = (accrualEnd.getTime() - lastAccruedAt.getTime()) / 3600000;
    user.points = Number((user.points + elapsedHours * mining.hourlyRate).toFixed(4));
    mining.lastAccruedAt = accrualEnd;
    hasChanged = true;
  }

  if (now.getTime() >= activeUntil.getTime()) {
    mining.active = false;
    hasChanged = true;
  }

  return hasChanged;
}

function startMiningWindow(user) {
  const mining = ensureMiningState(user);
  const now = new Date();

  if (mining.active && mining.activeUntil && new Date(mining.activeUntil).getTime() > now.getTime()) {
    return false;
  }

  const activeUntil = new Date(now.getTime() + MINING_WINDOW_HOURS * 3600000);

  user.mining = {
    active: true,
    activatedAt: now,
    activeUntil,
    baseRate: mining.baseRate || BASE_MINING_RATE,
    hourlyRate: mining.hourlyRate || BASE_MINING_RATE,
    lastAccruedAt: now,
    referralBoostRate: mining.referralBoostRate || 0,
    referralCount: mining.referralCount || 0,
  };

  return true;
}

module.exports = {
  BASE_MINING_RATE,
  REFERRAL_RATE_STEP,
  syncMiningState,
  syncReferralMiningRate,
  startMiningWindow,
};
