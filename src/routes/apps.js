import express from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';

export const appsRouter = express.Router();

const selectSchema = Joi.object({
  apps: Joi.array()
    .items(
      Joi.object({
        package: Joi.string().required(),
        enabled: Joi.boolean().required()
      })
    )
    .min(0)
    .required()
});

appsRouter.post('/select', requireAuth, async (req, res) => {
  try {
    const { value, error } = selectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { selectedApps: value.apps } },
      { new: true }
    );
    res.json({ selectedApps: user.selectedApps });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

appsRouter.get('/list', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    res.json({ selectedApps: user?.selectedApps || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


