const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    appPackage: {
      type: String,
      default: '',
      trim: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    postedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notificationKey: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

userNotificationSchema.index({ userId: 1, postedAt: -1 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);
