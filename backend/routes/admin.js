const express = require('express');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/admin');
const ApiError = require('../utils/errors');
const { logAudit } = require('../utils/audit');
const service = require('../services/meetingService');
const { escapeRegExp } = require('../utils/sanitize');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const actionLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'admin' });

router.use(auth, requireRole('admin'));

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lastNDays(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers24h,
      activeUsers7d,
      suspendedUsers,
      newUsers7d,
      totalMeetings,
      liveMeetings,
      completedMeetings,
      scheduledMeetings,
      cancelledMeetings,
      durationAgg,
      failedJoins,
      recentUsers,
      recentMeetings,
      recentErrors,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ lastActiveAt: { $gte: since24h } }),
      User.countDocuments({ lastActiveAt: { $gte: since7d } }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ createdAt: { $gte: since7d } }),
      Meeting.countDocuments({}),
      Meeting.countDocuments({ status: 'live' }),
      Meeting.countDocuments({ status: 'ended' }),
      Meeting.countDocuments({ status: 'scheduled' }),
      Meeting.countDocuments({ status: 'cancelled' }),
      Meeting.aggregate([
        { $match: { status: 'ended' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalMs: { $sum: { $subtract: ['$endedAt', '$startedAt'] } },
            participants: { $sum: '$stats.peakParticipants' },
          },
        },
      ]),
      AuditLog.countDocuments({ action: 'meeting.join_denied', createdAt: { $gte: since24h } }),
      User.find().sort({ createdAt: -1 }).limit(6).select('name email role status avatar createdAt'),
      Meeting.find().sort({ createdAt: -1 }).limit(6).populate('host', 'name email avatar'),
      AuditLog.countDocuments({ result: 'failure', createdAt: { $gte: since24h } }),
    ]);

    const duration = durationAgg[0] || { count: 0, totalMs: 0, participants: 0 };
    const avgMs = duration.count ? Math.round(duration.totalMs / duration.count) : 0;

    res.json({
      stats: {
        totalUsers,
        activeUsers: activeUsers24h,
        activeUsers7d,
        suspendedUsers,
        newUsers7d,
        totalMeetings,
        liveMeetings,
        completedMeetings,
        scheduledMeetings,
        cancelledMeetings,
        averageMeetingMs: avgMs,
        totalMeetingMinutes: Math.round((duration.totalMs || 0) / 60000),
        averageParticipants: duration.count ? Number((duration.participants / duration.count).toFixed(1)) : 0,
        failedJoins24h: failedJoins,
        failedRequests24h: recentErrors,
      },
      recentUsers,
      recentMeetings,
      isDemoData: false,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/analytics?days=14
router.get('/analytics', async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [registrations, meetingsByDay, attendanceByDay, failuresByDay, peakByDay, logActors] =
      await Promise.all([
        User.aggregate([
          { $match: { createdAt: { $gte: start } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Meeting.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              minutes: {
                $sum: {
                  $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 60000],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Meeting.aggregate([
          { $match: { 'attendance.joinedAt': { $gte: start } } },
          { $unwind: '$attendance' },
          { $match: { 'attendance.joinedAt': { $gte: start } } },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$attendance.joinedAt' } },
                user: '$attendance.user',
              },
            },
          },
          {
            $group: {
              _id: '$_id.day',
              users: { $addToSet: '$_id.user' },
              joins: { $sum: 1 },
            },
          },
          { $project: { _id: 1, dau: { $size: '$users' }, joins: 1 } },
          { $sort: { _id: 1 } },
        ]),
        AuditLog.aggregate([
          { $match: { action: 'meeting.join_denied', createdAt: { $gte: start } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Meeting.aggregate([
          { $match: { startedAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
              peak: { $max: '$stats.peakParticipants' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        AuditLog.aggregate([
          { $match: { createdAt: { $gte: start } } },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                actor: '$actor',
              },
            },
          },
          { $group: { _id: '$_id.day', users: { $addToSet: '$_id.actor' } } },
          { $project: { _id: 1, dau: { $size: '$users' } } },
        ]),
      ]);

    const keys = lastNDays(days);
    const mapOf = (rows, field = 'count') =>
      Object.fromEntries(rows.map((r) => [r._id, Number((r[field] || 0).toFixed(1))]));

    const regMap = mapOf(registrations);
    const meetMap = mapOf(meetingsByDay, 'count');
    const minutesMap = mapOf(meetingsByDay, 'minutes');
    const attMap = mapOf(attendanceByDay, 'dau');
    const logMap = mapOf(logActors, 'dau');
    const failMap = mapOf(failuresByDay);
    const peakMap = mapOf(peakByDay, 'peak');

    const dauSeries = keys.map((k) => Math.max(attMap[k] || 0, logMap[k] || 0));

    const wau = await User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 7 * 864e5) } });
    const mau = await User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 30 * 864e5) } });
    const totalUsers = await User.countDocuments({});
    const avgParticipantsAgg = await Meeting.aggregate([
      { $match: { status: 'ended' } },
      { $group: { _id: null, avg: { $avg: '$stats.peakParticipants' } } },
    ]);

    res.json({
      range: { days, start: keys[0], end: keys[keys.length - 1] },
      series: {
        labels: keys,
        dau: dauSeries,
        registrations: keys.map((k) => regMap[k] || 0),
        meetings: keys.map((k) => meetMap[k] || 0),
        meetingMinutes: keys.map((k) => Math.round(minutesMap[k] || 0)),
        failedJoins: keys.map((k) => failMap[k] || 0),
        peakConcurrent: keys.map((k) => peakMap[k] || 0),
      },
      totals: {
        dau: dauSeries[dauSeries.length - 1] || 0,
        wau,
        mau,
        peakConcurrent: Math.max(...dauSeries, 0),
        averageParticipants: avgParticipantsAgg[0]?.avg ? Number(avgParticipantsAgg[0].avg.toFixed(1)) : 0,
        newUsers: keys.reduce((sum, k) => sum + (regMap[k] || 0), 0),
        retention7d: totalUsers ? Number(((wau / totalUsers) * 100).toFixed(1)) : 0,
        retention30d: totalUsers ? Number(((mau / totalUsers) * 100).toFixed(1)) : 0,
      },
      isDemoData: false,
      source: 'Computed from live database records',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      const rx = new RegExp(escapeRegExp(String(req.query.search).slice(0, 100)), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name email username role status avatar createdAt lastActiveAt lastLoginAt meetingStats'),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name email username role status avatar bio timezone language createdAt lastActiveAt lastLoginAt meetingStats preferences'
    );
    if (!user) throw ApiError.notFound('User not found');
    const [hosted, attended] = await Promise.all([
      Meeting.countDocuments({ host: user._id }),
      Meeting.countDocuments({ participants: user._id, host: { $ne: user._id } }),
    ]);
    res.json({ user, meetings: { hosted, attended } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id - status / role
router.patch('/users/:id', actionLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    const { status, role, action } = req.body || {};

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) throw ApiError.badRequest('Invalid role');
      if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own role');
      user.role = role;
      await logAudit({ req, action: 'user.role_changed', target: String(user._id), targetType: 'user', meta: { role } });
    }

    if (status !== undefined) {
      if (!['active', 'suspended'].includes(status)) throw ApiError.badRequest('Invalid status');
      if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot suspend your own account');
      user.status = status;
      await logAudit({
        req,
        action: status === 'suspended' ? 'user.suspended' : 'user.activated',
        target: String(user._id),
        targetType: 'user',
        meta: { status },
      });
      await Notification.create({
        user: user._id,
        type: 'account',
        title: status === 'suspended' ? 'Your account has been suspended' : 'Your account has been reactivated',
        body:
          status === 'suspended'
            ? 'Contact support if you believe this is a mistake.'
            : 'You can sign in again.',
      });
    }

    if (action === 'delete') {
      if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot delete your own account');
      await logAudit({ req, action: 'user.deleted', target: String(user._id), targetType: 'user', meta: { email: user.email } });
      await Meeting.updateMany({ host: user._id, status: { $in: ['scheduled', 'live'] } }, [
        { $set: { status: 'cancelled', endedAt: new Date() } },
      ]);
      await user.deleteOne();
      return res.json({ ok: true, deleted: true });
    }

    await user.save();
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/meetings
router.get('/meetings', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegExp(String(req.query.search).slice(0, 100)), 'i');
      filter.$or = [{ title: rx }, { meetingId: rx }];
    }

    const [items, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('host', 'name email avatar'),
      Meeting.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/meetings/:id
router.get('/meetings/:id', async (req, res, next) => {
  try {
    const isValidObjectId = /^[a-f0-9]{24}$/i.test(req.params.id);
    const query = isValidObjectId
      ? { $or: [{ meetingId: req.params.id }, { _id: req.params.id }] }
      : { meetingId: req.params.id };
    const meeting = await Meeting.findOne(query).populate('host', 'name email avatar');
    if (!meeting) throw ApiError.notFound('Meeting not found');
    res.json({ meeting: meeting.toPublic({ forUser: req.user._id }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/meetings/:id/end
router.post('/meetings/:id/end', actionLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (meeting.status === 'ended') throw ApiError.conflict('Meeting already ended');
    await service.endMeeting(meeting, 'ended_by_admin');
    await logAudit({ req, action: 'meeting.ended_by_admin', target: meeting.meetingId, targetType: 'meeting' });
    await Notification.create({
      user: meeting.host,
      type: 'system',
      title: `Your meeting "${meeting.title}" was ended by an administrator`,
      body: 'An admin ended this meeting for moderation reasons.',
      link: `/meetings/${meeting.meetingId}`,
    });
    res.json({ ok: true, meeting: meeting.toPublic({ forUser: req.user._id }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/meetings/:id/cancel
router.post('/meetings/:id/cancel', actionLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (meeting.status === 'ended' || meeting.status === 'cancelled') throw ApiError.conflict('Meeting is already closed');
    meeting.status = 'cancelled';
    meeting.endedAt = new Date();
    await meeting.save();
    await logAudit({ req, action: 'meeting.cancelled_by_admin', target: meeting.meetingId, targetType: 'meeting' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit
router.get('/audit', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const filter = {};
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.result) filter.result = req.query.result;
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    if (req.query.search) {
      const rx = new RegExp(escapeRegExp(String(req.query.search).slice(0, 100)), 'i');
      filter.$or = [{ action: rx }, { actorName: rx }, { target: rx }];
    }

    const [items, total, actions] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email'),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('action'),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      actions: actions.sort(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
