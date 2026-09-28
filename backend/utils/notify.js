const Notification = require('../models/Notification');
const User = require('../models/User');

async function notifyUser(userId, { type, title, body = '', link = null, meta = {} }) {
  if (!userId) return null;
  try {
    const user = await User.findById(userId).select('preferences');
    if (user?.preferences?.notifications === false) return null;
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      link,
      meta,
    });
    return notification;
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return null;
  }
}

async function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).map(String))];
  await Promise.all(unique.map((id) => notifyUser(id, payload)));
}

module.exports = { notifyUser, notifyMany };
