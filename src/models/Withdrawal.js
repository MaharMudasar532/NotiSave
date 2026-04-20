const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
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
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    country: {
      type: String,
      default: 'Pakistan',
    },
    userInitials: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
