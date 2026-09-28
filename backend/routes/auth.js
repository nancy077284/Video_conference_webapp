const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const ApiError = require('../utils/errors');
const { validateRegister, validatePassword } = require('../utils/validate');
const { isEmail, cleanName, cleanText, clip } = require('../utils/sanitize');
const { logAudit } = require('../utils/audit');
const { notifyUser } = require('../utils/notify');
const { config } = require('../config/env');

const router = express.Router();

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth' });
const strictLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'auth-strict' });

const signToken = (user) =>
  jwt.sign({ userId: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, username } = req.body || {};
    const errors = validateRegister({ name, email, password });
    if (errors) {
      return res.status(400).json({ error: Object.values(errors)[0], code: 'BAD_REQUEST', fields: errors });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ $or: [{ email: normalizedEmail }] });
    if (existing) {
      await logAudit({ req, action: 'auth.register', result: 'failure', meta: { email: normalizedEmail }, target: normalizedEmail, targetType: 'user' });
      return res.status(409).json({ error: 'An account with that email already exists', code: 'CONFLICT' });
    }

    const cleanUsername = username ? clip(String(username).toLowerCase().replace(/[^a-z0-9_.-]/g, ''), 30) : undefined;
    if (cleanUsername) {
      const taken = await User.findOne({ username: cleanUsername });
      if (taken) return res.status(409).json({ error: 'That username is taken', code: 'CONFLICT' });
    }

    const user = await User.create({
      name: cleanName(name),
      email: normalizedEmail,
      password,
      username: cleanUsername || undefined,
    });

    await logAudit({ req, actor: user._id, action: 'auth.register', target: String(user._id), targetType: 'user' });
    await notifyUser(user._id, {
      type: 'system',
      title: 'Welcome to VidConApp',
      body: 'Your account is ready. Schedule your first meeting from the dashboard.',
      link: '/dashboard',
    });

    const token = signToken(user);
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }
    if (!isEmail(email)) throw ApiError.badRequest('Please enter a valid email address');

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    const invalid = ApiError.unauthorized('Invalid email or password');
    if (!user) {
      await logAudit({ req, action: 'auth.login', result: 'failure', meta: { email }, targetType: 'user' });
      throw invalid;
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      await logAudit({ req, actor: user._id, action: 'auth.login', result: 'failure', target: String(user._id), targetType: 'user' });
      throw invalid;
    }
    if (user.status === 'suspended') {
      await logAudit({ req, actor: user._id, action: 'auth.login', result: 'failure', meta: { reason: 'suspended' }, targetType: 'user' });
      throw ApiError.forbidden('This account has been suspended. Contact support.');
    }

    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await user.save({ validateBeforeSave: false });

    await logAudit({ req, actor: user._id, action: 'auth.login', target: String(user._id), targetType: 'user' });
    const token = signToken(user);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', auth, async (req, res, next) => {
  try {
    await logAudit({ req, action: 'auth.logout', target: String(req.user._id), targetType: 'user' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

router.post('/forgot-password', strictLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const response = { ok: true, message: 'If an account exists for that email, a reset link has been generated.' };
    if (!isEmail(email || '')) return res.json(response);

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+resetToken +resetExpires');
    if (!user) return res.json(response);

    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await logAudit({ req, actor: user._id, action: 'auth.password_reset_requested', target: String(user._id), targetType: 'user' });

    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    const payload = {
      type: 'account',
      title: 'Password reset requested',
      body: 'Use the link below to reset your password. It expires in 30 minutes.',
      link: resetUrl,
    };
    await notifyUser(user._id, payload);

    if (!config.isProd) {
      return res.json({ ...response, devResetUrl: resetUrl, devNote: 'Dev mode only: email delivery is not configured.' });
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', strictLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token) throw ApiError.badRequest('Reset token is required');
    const pwError = validatePassword(password);
    if (pwError) throw ApiError.badRequest(pwError);

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ resetToken: hashed, resetExpires: { $gt: new Date() } }).select(
      '+resetToken +resetExpires +password'
    );
    if (!user) {
      await logAudit({ req, action: 'auth.password_reset', result: 'failure', targetType: 'user' });
      throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    await logAudit({ req, actor: user._id, action: 'auth.password_reset', target: String(user._id), targetType: 'user' });
    await notifyUser(user._id, {
      type: 'account',
      title: 'Your password was changed',
      body: 'If this was not you, reset your password immediately.',
    });
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', auth, strictLimiter, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const user = await User.findById(req.user._id).select('+password');
    const ok = await user.comparePassword(currentPassword || '');
    if (!ok) throw ApiError.badRequest('Current password is incorrect');
    const pwError = validatePassword(newPassword);
    if (pwError) throw ApiError.badRequest(pwError);

    user.password = newPassword;
    await user.save();
    await logAudit({ req, action: 'auth.password_change', target: String(user._id), targetType: 'user' });
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', auth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const user = await User.findById(req.user._id);

    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (name.length < 2) throw ApiError.badRequest('Name must be at least 2 characters');
      user.name = name;
    }
    if (body.bio !== undefined) user.bio = clip(cleanText(body.bio, 500), 500);
    if (body.timezone !== undefined) user.timezone = clip(String(body.timezone), 60) || 'UTC';
    if (body.language !== undefined) user.language = clip(String(body.language), 10) || 'en';
    if (body.avatar !== undefined) {
      const avatar = String(body.avatar || '');
      if (avatar && !avatar.startsWith('data:image/') && !/^https?:\/\//.test(avatar)) {
        throw ApiError.badRequest('Avatar must be an image URL or data URL');
      }
      if (avatar.length > 300000) throw ApiError.badRequest('Avatar image is too large (max 200KB)');
      user.avatar = avatar;
    }
    if (body.username !== undefined && body.username !== '') {
      const cleanUsername = clip(String(body.username).toLowerCase().replace(/[^a-z0-9_.-]/g, ''), 30);
      if (cleanUsername.length < 3) throw ApiError.badRequest('Username must be at least 3 characters');
      const taken = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (taken) throw ApiError.conflict('That username is taken');
      user.username = cleanUsername;
    }
    if (body.preferences && typeof body.preferences === 'object') {
      const allowed = [
        'notifications',
        'emailNotifications',
        'meetingReminders',
        'joinAudioMuted',
        'joinVideoOff',
        'preferredMicrophone',
        'preferredCamera',
        'preferredSpeaker',
        'theme',
      ];
      allowed.forEach((key) => {
        if (body.preferences[key] !== undefined) user.preferences[key] = body.preferences[key];
      });
    }

    await user.save();
    await logAudit({ req, action: 'user.profile_updated', target: String(user._id), targetType: 'user' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [hosted, attendedAgg, upcoming] = await Promise.all([
      Meeting.countDocuments({ host: userId, status: { $in: ['scheduled', 'live', 'ended'] } }),
      Meeting.aggregate([
        { $match: { 'attendance.user': userId, status: 'ended' } },
        { $unwind: '$attendance' },
        { $match: { 'attendance.user': userId } },
        { $group: { _id: null, count: { $sum: 1 }, totalMs: { $sum: '$attendance.durationMs' } } },
      ]),
      Meeting.countDocuments({
        $or: [{ host: userId }, { participants: userId }],
        status: 'scheduled',
        scheduledAt: { $gte: now },
      }),
    ]);

    const attended = attendedAgg[0] || { count: 0, totalMs: 0 };
    const totalMs = attended.totalMs || 0;
    const attendedCount = attended.count || 0;

    res.json({
      stats: {
        totalMeetings: hosted + attendedCount,
        meetingsHosted: hosted,
        meetingsAttended: attendedCount,
        totalDurationMs: totalMs,
        averageDurationMs: attendedCount ? Math.round(totalMs / attendedCount) : 0,
        upcoming,
        todayMeetings: await Meeting.countDocuments({
          $or: [{ host: userId }, { participants: userId }],
          status: { $in: ['scheduled', 'live'] },
          scheduledAt: { $gte: startOfDay },
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
