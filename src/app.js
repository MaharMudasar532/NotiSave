const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const audioRoutes = require('./routes/audioRoutes');
const adminRoutes = require('./routes/adminRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const adminStaticPath = path.resolve(__dirname, '../public/admin');
const privacyPolicyPath = path.resolve(__dirname, '../public/privacy-policy.html');

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/privacy-policy', (_request, response) => {
  response.sendFile(privacyPolicyPath);
});

app.use(express.static(adminStaticPath));
app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api/')) {
    return next();
  }

  response.sendFile(path.join(adminStaticPath, 'index.html'));
});

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode || 500;

  response.status(statusCode).json({
    message: error.message || 'Internal server error.',
  });
});

module.exports = app;