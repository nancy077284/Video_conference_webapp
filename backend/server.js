const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('./config/env');

const { config } = require('./config/env');
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const notificationRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const { notFound, errorHandler } = require('./middleware/error');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '600kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', notFound);

const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const io = initSocket(server);
app.set('io', io);

mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log('MongoDB connected successfully to:', config.mongoUri.includes('mongodb+srv') ? 'MongoDB Atlas Cluster' : 'Local MongoDB');
  } catch (err) {
    console.warn(`[MongoDB] Atlas connection pending/whitelisting (${err.message}). Connecting to local MongoDB...`);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/vidconapp', { serverSelectionTimeoutMS: 3000 });
      console.log('[MongoDB] Connected to local MongoDB fallback (mongodb://127.0.0.1:27017/vidconapp)');
    } catch (fallbackErr) {
      console.error('[MongoDB] Could not connect to fallback:', fallbackErr.message);
    }
  }
};

connectDB();

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

module.exports = { app, server };
