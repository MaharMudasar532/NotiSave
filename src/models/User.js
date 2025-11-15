import mongoose from 'mongoose';

const SelectedAppSchema = new mongoose.Schema(
  {
    package: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: true }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    selectedApps: { type: [SelectedAppSchema], default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

UserSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', UserSchema);


