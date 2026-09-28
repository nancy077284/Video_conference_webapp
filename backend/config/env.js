const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  });
}

const buildIceServers = () => {
  const servers = [
    { urls: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302' },
    { urls: process.env.STUN_SERVER_2 || 'stun:stun1.l.google.com:19302' },
  ];
  if (process.env.TURN_SERVER) {
    servers.push({
      urls: process.env.TURN_SERVER,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_PASSWORD || '',
    });
  }
  return servers;
};

const config = {
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vidconapp',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  iceServers: buildIceServers(),
  isProd: process.env.NODE_ENV === 'production',
  maxParticipants: Number(process.env.MAX_PARTICIPANTS || 50),
};

if (!config.jwtSecret && config.isProd) {
  throw new Error('JWT_SECRET must be set in production');
}
if (!config.jwtSecret) {
  config.jwtSecret = 'dev_only_insecure_secret_change_me';
  console.warn('[env] JWT_SECRET missing - using insecure development default');
}

module.exports = { config, buildIceServers };
