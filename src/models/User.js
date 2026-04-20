const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    storageQuotaBytes: {
      type: Number,
      default: 10 * 1024 * 1024 * 1024,
    },
    storageUsedBytes: {
      type: Number,
      default: 0,
    },
    backupEnabled: {
      type: Boolean,
      default: false,
    },
    withdraw: {
      type: Boolean,
      default: false,
    },
    bankDetails: {
      type: {
        accountNumber: {
          type: String,
          trim: true,
        },
        accountTitle: {
          type: String,
          trim: true,
        },
        bankName: {
          type: String,
          trim: true,
        },
      },
      default: null,
    },
    mining: {
      type: {
        active: {
          type: Boolean,
          default: false,
        },
        activatedAt: {
          type: Date,
          default: null,
        },
        activeUntil: {
          type: Date,
          default: null,
        },
        baseRate: {
          type: Number,
          default: 0.005,
        },
        hourlyRate: {
          type: Number,
          default: 0.005,
        },
        lastAccruedAt: {
          type: Date,
          default: null,
        },
        referralBoostRate: {
          type: Number,
          default: 0,
        },
        referralCount: {
          type: Number,
          default: 0,
        },
      },
      default: () => ({
        active: false,
        activatedAt: null,
        activeUntil: null,
        baseRate: 0.005,
        hourlyRate: 0.005,
        lastAccruedAt: null,
        referralBoostRate: 0,
        referralCount: 0,
      }),
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('User', userSchema);