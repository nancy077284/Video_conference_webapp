const express = require('express');
const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const ApiError = require('../utils/errors');
const { validateSchedule, parseEmailList } = require('../utils/validate');
const { cleanSubject, cleanText, clip } = require('../utils/sanitize');
const { logAudit } = require('../utils/audit');
const { notifyMany, notifyUser } = require('../utils/notify');
const service = require('../services/meetingService');
const { config } = require('../config/env');

const router = express.Router();
const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, keyPrefix: 'meet-write' });

const generateMeetingId = () => crypto.randomBytes(5).toString('hex');

async function resolveInvitees(emails) {
  const { valid, invalid } = parseEmailList(emails);
  if (invalid.length) throw ApiError.badRequest(`Invalid email address: ${invalid[0]}`);
  if (valid.length > 50) throw ApiError.badRequest('You can invite up to 50 people');
  if (!valid.length) return [];
  const users = await UserFindMany(valid);
  return valid.map((email) => ({
    email,
    user: users.get(email) ? users.get(email)._id : undefined,
    status: 'invited',
  }));
}

async function UserFindMany(emails) {
  const User = require('../models/User');
  const docs = await User.find({ email: { $in: emails } }).select('_id email');
  return new Map(docs.map((d) => [d.email, d]));
}

// POST /api/meetings/create - instant meeting
router.post('/create', auth, writeLimiter, async (req, res, next) => {
  try {
    const title = cleanSubject(req.body?.title || 'Instant meeting');
    const meeting = await Meeting.create({
      meetingId: generateMeetingId(),
      host: req.user._id,
      title,
      type: 'instant',
      status: 'live',
      startedAt: new Date(),
      participants: [req.user._id],
      timezone: req.user.timezone || 'UTC',
    });
    await logAudit({ req, action: 'meeting.created', target: meeting.meetingId, targetType: 'meeting', meta: { type: 'instant', title } });
    res.status(201).json({ meeting: meeting.toPublic({ host: publicHost(req.user), forUser: req.user._id }) });
  } catch (err) {
    next(err);
  }
});

function publicHost(user) {
  if (!user) return null;
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || '',
    username: user.username || '',
  };
}

// POST /api/meetings/schedule
router.post('/schedule', auth, writeLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = validateSchedule(body);
    if (result.errors) {
      return res.status(400).json({ error: Object.values(result.errors)[0], code: 'BAD_REQUEST', fields: result.errors });
    }

    const invitees = await resolveInvitees(body.invitees);
    const meeting = await Meeting.create({
      meetingId: generateMeetingId(),
      host: req.user._id,
      title: result.title,
      description: clip(cleanText(body.description || '', 1000), 1000),
      type: 'scheduled',
      status: 'scheduled',
      scheduledAt: result.scheduledAt,
      endsAt: result.endsAt || undefined,
      timezone: body.timezone || req.user.timezone || 'UTC',
      password: body.password ? service.hashMeetingPassword(body.password) : undefined,
      waitingRoom: Boolean(body.waitingRoom),
      invitees,
      participants: [req.user._id],
      settings: {
        allowChat: body.settings?.allowChat !== false,
        allowScreenShare: body.settings?.allowScreenShare !== false,
        allowRaiseHand: body.settings?.allowRaiseHand !== false,
        allowParticipantRecording: body.settings?.allowParticipantRecording !== false,
        maxParticipants: Math.min(Number(body.settings?.maxParticipants) || 50, config.maxParticipants),
      },
    });

    const inviteeIds = invitees.filter((i) => i.user).map((i) => i.user);
    await notifyMany(inviteeIds, {
      type: 'meeting_invitation',
      title: `${req.user.name} invited you to "${meeting.title}"`,
      body: `Scheduled for ${new Date(meeting.scheduledAt).toLocaleString()}`,
      link: `/meetings/${meeting.meetingId}`,
      meta: { meetingId: meeting.meetingId },
    });
    if (inviteeIds.length) {
      await Meeting.updateOne({ _id: meeting._id }, { $addToSet: { participants: { $each: inviteeIds } } });
    }

    await logAudit({ req, action: 'meeting.scheduled', target: meeting.meetingId, targetType: 'meeting', meta: { scheduledAt: meeting.scheduledAt, invitees: invitees.length } });
    res.status(201).json({ meeting: meeting.toPublic({ host: publicHost(req.user), forUser: req.user._id }) });
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/dashboard
router.get('/dashboard', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await Meeting.find({
      $or: [{ host: userId }, { participants: userId }],
      status: 'scheduled',
      scheduledAt: { $gte: now },
    })
      .sort({ scheduledAt: 1 })
      .limit(8)
      .populate('host', 'name email avatar username');

    const todays = await Meeting.find({
      $or: [{ host: userId }, { participants: userId }],
      status: { $in: ['scheduled', 'live'] },
      scheduledAt: { $gte: startOfDay, $lt: endOfDay },
    })
      .sort({ scheduledAt: 1 })
      .limit(8)
      .populate('host', 'name email avatar username');

    const recent = await Meeting.find({
      $or: [{ host: userId }, { participants: userId }],
      status: { $in: ['ended', 'live', 'cancelled'] },
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('host', 'name email avatar username');

    const live = await Meeting.find({
      $or: [{ host: userId }, { participants: userId }],
      status: 'live',
    })
      .sort({ startedAt: -1 })
      .limit(5)
      .populate('host', 'name email avatar username');

    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(6);
    const unread = await Notification.countDocuments({ user: userId, read: false });

    res.json({
      upcoming: upcoming.map((m) => m.toPublic({ forUser: userId })),
      today: todays.map((m) => m.toPublic({ forUser: userId })),
      recent: recent.map((m) => m.toPublic({ forUser: userId })),
      live: live.map((m) => m.toPublic({ forUser: userId })),
      notifications,
      unreadCount: unread,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings?tab=upcoming|past|hosted|joined
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const tab = String(req.query.tab || 'upcoming');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const search = String(req.query.search || '').slice(0, 100);

    const now = new Date();
    const filter = { $or: [{ host: userId }, { participants: userId }] };

    if (tab === 'upcoming') {
      filter.status = 'scheduled';
      filter.scheduledAt = { $gte: now };
    } else if (tab === 'past') {
      filter.status = { $in: ['ended', 'cancelled'] };
    } else if (tab === 'hosted') {
      filter.host = userId;
    } else if (tab === 'joined') {
      filter.host = { $ne: userId };
      filter.participants = userId;
    }

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [...(filter.$and || []), { $or: [{ title: rx }, { meetingId: rx }] }];
    }

    const [items, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ [tab === 'past' ? 'updatedAt' : 'scheduledAt']: tab === 'past' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('host', 'name email avatar username'),
      Meeting.countDocuments(filter),
    ]);

    res.json({
      items: items.map((m) => m.toPublic({ forUser: userId })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/:meetingId
router.get('/:meetingId', auth, async (req, res, next) => {
  try {
    const meeting = await service.getMeetingByCode(req.params.meetingId);
    if (!meeting) throw ApiError.notFound('Meeting not found');

    const userId = req.user._id;
    const isHost = service.isHostOf(meeting, userId);
    const isAdmin = req.user.role === 'admin';
    const invited = (meeting.invitees || []).some((i) => String(i.user || '') === String(userId));
    const joined = service.hasJoined(meeting, userId);

    if (!isHost && !isAdmin && !invited && !joined && meeting.status === 'scheduled') {
      throw ApiError.forbidden('You are not invited to this meeting');
    }

    const canManage = isHost || isAdmin;
    const payload = meeting.toPublic({ forUser: userId });
    if (canManage) payload.waiting = meeting.waiting;
    if (!canManage) delete payload.settings;

    res.json({ meeting: payload, canManage });
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings/:meetingId/join - validates access, returns join grant
router.post('/:meetingId/join', auth, writeLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .select('+password')
      .populate('host', 'name email avatar username');
    const verdict = service.evaluateJoin(meeting, req.user, { password: req.body?.password });

    if (!verdict.allowed && verdict.reason !== 'waiting_room') {
      await logAudit({
        req,
        action: 'meeting.join_denied',
        result: 'failure',
        target: req.params.meetingId,
        targetType: 'meeting',
        meta: { reason: verdict.reason },
      });
      const status =
        verdict.reason === 'not_found' ? 404 :
        ['password_invalid', 'password_required'].includes(verdict.reason) ? 401 :
        ['locked', 'too_early'].includes(verdict.reason) ? 403 :
        ['ended', 'cancelled'].includes(verdict.reason) ? 409 : 400;
      throw new ApiError(status, verdict.message);
    }

    if (verdict.allowed) {
      await service.recordJoin(meeting, req.user);
      await logAudit({ req, action: 'meeting.joined', target: meeting.meetingId, targetType: 'meeting' });
      if (!service.isHostOf(meeting, req.user)) {
        await notifyUser(meeting.host?._id || meeting.host, {
          type: 'participant_joined',
          title: `${req.user.name} joined "${meeting.title}"`,
          link: `/meetings/${meeting.meetingId}`,
        });
      }
    }

    res.json({
      allowed: verdict.allowed,
      waiting: Boolean(verdict.waiting),
      reason: verdict.reason || null,
      message: verdict.message || null,
      meeting: meeting.toPublic({ forUser: req.user._id }),
      iceServers: config.iceServers,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings/:meetingId/leave
router.post('/:meetingId/leave', auth, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    await service.recordLeave(meeting, req.user._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings/:meetingId/end - host or admin terminates live meeting for everyone
router.post('/:meetingId/end', auth, writeLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId }).select('+password');
    if (!meeting) throw ApiError.notFound('Meeting not found');

    const isHost = service.isHostOf(meeting, req.user);
    if (!isHost && req.user.role !== 'admin') {
      throw ApiError.forbidden('Only the host can terminate this meeting');
    }

    if (meeting.status !== 'ended') {
      await service.endMeeting(meeting, req.user.role === 'admin' ? 'ended_by_admin' : 'host_ended');
    }

    // Broadcast room:ended via socket to disconnect all clients
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(meeting.meetingId).emit('room:ended', { reason: 'The host ended the meeting' });
        io.to(meeting.meetingId).emit('meeting-ended', { reason: 'The host ended the meeting' });
        io.to(meeting.meetingId).emit('room:state', { ended: true });
        const sockets = await io.in(meeting.meetingId).fetchSockets();
        sockets.forEach((s) => {
          s.leave(meeting.meetingId);
          s.data.roomId = null;
        });
      }
    } catch (e) {
      // non-fatal socket error
    }

    await logAudit({
      req,
      action: 'meeting.ended_by_host',
      target: meeting.meetingId,
      targetType: 'meeting',
    });

    res.json({
      ok: true,
      ended: true,
      message: 'Meeting terminated successfully for all participants',
      meeting: meeting.toPublic({ forUser: req.user._id }),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/meetings/:meetingId - host settings / lock / waiting room / title
router.patch('/:meetingId', auth, writeLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId }).select('+password');
    if (!meeting) throw ApiError.notFound('Meeting not found');
    service.assertHost(meeting, req.user);

    const body = req.body || {};
    const changed = [];

    if (body.title !== undefined) {
      const title = cleanSubject(body.title, 140);
      if (!title) throw ApiError.badRequest('Title cannot be empty');
      meeting.title = title;
      changed.push('title');
    }
    if (body.description !== undefined) {
      meeting.description = clip(cleanText(body.description, 1000), 1000);
      changed.push('description');
    }
    if (body.waitingRoom !== undefined) {
      meeting.waitingRoom = Boolean(body.waitingRoom);
      changed.push('waitingRoom');
    }
    if (body.locked !== undefined) {
      meeting.locked = Boolean(body.locked);
      changed.push('locked');
    }
    if (body.password !== undefined) {
      meeting.password = body.password ? service.hashMeetingPassword(body.password) : undefined;
      changed.push('password');
    }
    if (body.settings && typeof body.settings === 'object') {
      ['allowChat', 'allowScreenShare', 'allowRaiseHand', 'allowParticipantRecording'].forEach((key) => {
        if (body.settings[key] !== undefined) meeting.settings[key] = Boolean(body.settings[key]);
      });
      if (body.settings.maxParticipants !== undefined) {
        meeting.settings.maxParticipants = Math.min(
          Math.max(1, Number(body.settings.maxParticipants) || 50),
          config.maxParticipants
        );
      }
      changed.push('settings');
    }
    if (body.scheduledAt !== undefined || body.endsAt !== undefined) {
      const check = validateSchedule({
        title: meeting.title,
        scheduledAt: body.scheduledAt || meeting.scheduledAt,
        endsAt: body.endsAt || meeting.endsAt,
      });
      if (check.errors) return res.status(400).json({ error: Object.values(check.errors)[0], code: 'BAD_REQUEST', fields: check.errors });
      meeting.scheduledAt = check.scheduledAt;
      meeting.endsAt = check.endsAt || undefined;
      changed.push('schedule');
    }

    await meeting.save();
    await logAudit({ req, action: 'meeting.updated', target: meeting.meetingId, targetType: 'meeting', meta: { changed } });
    res.json({ meeting: meeting.toPublic({ forUser: req.user._id }) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meetings/history/clear - clear all past/ended meetings
router.delete('/history/clear', auth, writeLimiter, async (req, res, next) => {
  try {
    const userId = req.user._id;
    // Hosted past meetings: permanently delete them and messages
    const hostedPast = await Meeting.find({
      host: userId,
      status: { $in: ['ended', 'cancelled'] },
    }).select('_id meetingId');

    const hostedIds = hostedPast.map((m) => m._id);
    if (hostedIds.length > 0) {
      await Message.deleteMany({ meeting: { $in: hostedIds } });
      await Meeting.deleteMany({ _id: { $in: hostedIds } });
    }

    // Joined past meetings: pull user from participants list
    await Meeting.updateMany(
      {
        host: { $ne: userId },
        participants: userId,
        status: { $in: ['ended', 'cancelled'] },
      },
      {
        $pull: {
          participants: userId,
          invitees: { user: userId },
        },
      }
    );

    await logAudit({
      req,
      action: 'meetings.history_cleared',
      target: String(userId),
      targetType: 'user',
      meta: { deletedHostedCount: hostedIds.length },
    });

    res.json({
      ok: true,
      message: `Cleared ${hostedIds.length} past hosted meeting(s) and removed past joined meetings`,
      deletedCount: hostedIds.length,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meetings/:meetingId - delete past meeting or cancel/delete scheduled meeting
router.delete('/:meetingId', auth, writeLimiter, async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) throw ApiError.notFound('Meeting not found');

    const isHost = service.isHostOf(meeting, req.user);
    const isAdmin = req.user.role === 'admin';
    const permanent = req.query.permanent === 'true' || req.body?.permanent === true;

    if (isHost || isAdmin) {
      // If the meeting is ended or cancelled, or permanent deletion is explicitly requested:
      if (permanent || meeting.status === 'ended' || meeting.status === 'cancelled') {
        await Message.deleteMany({ meeting: meeting._id });
        await Meeting.deleteOne({ _id: meeting._id });
        await logAudit({ req, action: 'meeting.deleted', target: meeting.meetingId, targetType: 'meeting' });
        return res.json({ ok: true, deleted: true, message: 'Meeting deleted successfully' });
      }

      // If it is scheduled or live, mark as cancelled
      meeting.status = 'cancelled';
      meeting.endedAt = new Date();
      await meeting.save();

      await notifyMany(
        (meeting.participants || []).filter((p) => String(p) !== String(req.user._id)),
        {
          type: 'meeting_cancelled',
          title: `"${meeting.title}" was cancelled`,
          body: 'The host cancelled this meeting.',
          link: '/meetings',
        }
      );
      await logAudit({ req, action: 'meeting.cancelled', target: meeting.meetingId, targetType: 'meeting' });
      return res.json({ ok: true, cancelled: true, message: 'Meeting cancelled' });
    } else {
      // If a participant deletes a past meeting, remove it from their history
      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $pull: {
            participants: req.user._id,
            invitees: { user: req.user._id },
          },
        }
      );
      await logAudit({ req, action: 'meeting.removed_from_history', target: meeting.meetingId, targetType: 'meeting' });
      return res.json({ ok: true, removed: true, message: 'Meeting removed from your list' });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/:meetingId/messages
router.get('/:meetingId/messages', auth, async (req, res, next) => {
  try {
    const meeting = await service.getMeetingByCode(req.params.meetingId);
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!service.hasJoined(meeting, req.user) && req.user.role !== 'admin') {
      throw ApiError.forbidden('Join the meeting to view chat');
    }
    const messages = await Message.find({ meeting: meeting._id, deleted: false })
      .sort({ createdAt: 1 })
      .limit(300);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings/:meetingId/recordings - client registers recording metadata
router.post('/:meetingId/recordings', auth, writeLimiter, async (req, res, next) => {
  try {
    const meeting = await service.getMeetingByCode(req.params.meetingId);
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!service.hasJoined(meeting, req.user) && req.user.role !== 'admin') {
      throw ApiError.forbidden('Not a participant of this meeting');
    }
    const body = req.body || {};
    const status = ['recording', 'completed', 'upload_failed'].includes(body.status)
      ? body.status
      : 'upload_failed';
    const entry = {
      startedBy: req.user._id,
      startedByName: req.user.name,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      endedAt: body.endedAt ? new Date(body.endedAt) : undefined,
      durationMs: Math.max(0, Number(body.durationMs) || 0),
      sizeBytes: Math.max(0, Number(body.sizeBytes) || 0),
      fileName: clip(String(body.fileName || ''), 120),
      status,
      note: clip(String(body.note || ''), 300),
    };
    meeting.recordings.push(entry);
    await meeting.save();

    if (status === 'completed') {
      await notifyUser(req.user._id, {
        type: 'recording_available',
        title: `Recording available for "${meeting.title}"`,
        body: 'The recording was saved and is available in meeting details.',
        link: `/meetings/${meeting.meetingId}`,
      });
    }
    await logAudit({ req, action: 'meeting.recording_registered', target: meeting.meetingId, targetType: 'meeting', meta: { status } });
    res.status(201).json({ recording: entry });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
