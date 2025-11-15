import express from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';

export const notificationsRouter = express.Router();

const saveSchema = Joi.object({
  appPackage: Joi.string().required(),
  title: Joi.string().allow('').max(512),
  message: Joi.string().allow('').max(4096),
  timestamp: Joi.date().required()
});

notificationsRouter.post('/save', requireAuth, async (req, res) => {
  try {
    const { value, error } = saveSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const notification = await Notification.create({
      userId: req.user.id,
      appPackage: value.appPackage,
      title: value.title || '',
      message: value.message || '',
      timestamp: new Date(value.timestamp)
    });
    res.status(201).json({ id: notification._id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

notificationsRouter.get('/all', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments({ userId: req.user.id })
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

notificationsRouter.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, today, topApps] = await Promise.all([
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, timestamp: { $gte: todayStart } }),
      Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$appPackage', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);
    res.json({
      total,
      today,
      topApps: topApps.map(a => ({ appPackage: a._id, count: a.count }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


