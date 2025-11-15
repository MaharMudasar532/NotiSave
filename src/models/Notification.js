import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    appPackage: { type: String, index: true, required: true },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    timestamp: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

NotificationSchema.index({ userId: 1, timestamp: -1 });
NotificationSchema.index({ userId: 1, appPackage: 1, timestamp: -1 });

export const Notification = mongoose.model('Notification', NotificationSchema);


