const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const ApiError = require('../utils/errors');

function hashMeetingPassword(plain) {
  return `sha256:${crypto.createHash('sha256').update(String(plain)).digest('hex')}`;
}

function matchMeetingPassword(meeting, candidate) {
  if (!meeting.password) return true;
  if (!candidate) return false;
  const expected = String(meeting.password).replace(/^sha256:/, '');
  const actual = crypto.createHash('sha256').update(String(candidate)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch (e) {
    return false;
  }
}

async function getMeetingByCode(code) {
  if (!code || !/^[a-zA-Z0-9-]{4,32}$/.test(String(code))) return null;
  return Meeting.findOne({ meetingId: String(code) }).populate('host', 'name email avatar username');
}

function isHostOf(meeting, user) {
  return Boolean(user && meeting && String(meeting.host?._id || meeting.host) === String(user._id));
}

function hasJoined(meeting, user) {
  if (!meeting || !user) return false;
  if (isHostOf(meeting, user)) return true;
  if ((meeting.participants || []).some((p) => String(p?._id || p) === String(user._id))) return true;
  return (meeting.attendance || []).some((a) => String(a.user?._id || a.user) === String(user._id));
}

/**
 * Server-side gate for joining a meeting. Returns a machine readable reason
 * instead of throwing so the socket layer can also use it.
 */
function evaluateJoin(meeting, user, { password } = {}) {
  if (!meeting) return { allowed: false, reason: 'not_found', message: 'Meeting not found' };
  if (meeting.status === 'ended') return { allowed: false, reason: 'ended', message: 'This meeting has ended' };
  if (meeting.status === 'cancelled')
    return { allowed: false, reason: 'cancelled', message: 'This meeting was cancelled' };
  if (meeting.locked && !isHostOf(meeting, user))
    return { allowed: false, reason: 'locked', message: 'This meeting is locked by the host' };

  const alreadyJoined = hasJoined(meeting, user);
  if ((meeting.scheduledAt && meeting.scheduledAt.getTime() - Date.now() > 60 * 60 * 1000) && !isHostOf(meeting, user) && !alreadyJoined) {
    return { allowed: false, reason: 'too_early', message: 'This meeting has not started yet' };
  }

  if (meeting.password && !isHostOf(meeting, user)) {
    if (!password) return { allowed: false, reason: 'password_required', message: 'Meeting password required' };
    if (!matchMeetingPassword(meeting, password))
      return { allowed: false, reason: 'password_invalid', message: 'Incorrect meeting password' };
  }

  if (meeting.waitingRoom && !isHostOf(meeting, user)) {
    return { allowed: false, reason: 'waiting_room', message: 'Waiting for the host to admit you', waiting: true };
  }

  return { allowed: true };
}

async function recordJoin(meeting, user) {
  const now = new Date();
  const uid = String(user._id);
  const alreadyPresent = (meeting.attendance || []).find(
    (a) => String(a.user?._id || a.user) === uid && !a.leftAt
  );

  if (!alreadyPresent) {
    const existingClosed = (meeting.attendance || []).find(
      (a) => String(a.user?._id || a.user) === uid
    );
    if (existingClosed) {
      existingClosed.leftAt = undefined;
      existingClosed.joinedAt = now;
      existingClosed.connections = (existingClosed.connections || 0) + 1;
    } else {
      meeting.attendance.push({
        user: user._id,
        name: user.name,
        email: user.email,
        role: isHostOf(meeting, user) ? 'host' : 'participant',
        joinedAt: now,
        connections: 1,
      });
    }
  }

  if (!(meeting.participants || []).some((p) => String(p?._id || p) === uid)) {
    meeting.participants.push(user._id);
  }

  meeting.stats.totalJoins = (meeting.stats.totalJoins || 0) + 1;
  const activeCount = (meeting.attendance || []).filter((a) => !a.leftAt).length;
  meeting.stats.peakParticipants = Math.max(meeting.stats.peakParticipants || 0, activeCount);
  meeting.lastActivityAt = now;

  if (meeting.status === 'scheduled') {
    meeting.status = 'live';
    meeting.startedAt = meeting.startedAt || now;
  }

  await meeting.save();
  return meeting;
}

async function recordLeave(meeting, userId) {
  const uid = String(userId);
  const entry = (meeting.attendance || []).find((a) => String(a.user?._id || a.user) === uid && !a.leftAt);
  if (entry) {
    entry.leftAt = new Date();
    entry.durationMs = (entry.durationMs || 0) + Math.max(0, entry.leftAt - new Date(entry.joinedAt));
  }
  meeting.lastActivityAt = new Date();
  await meeting.save();
  return meeting;
}

async function endMeeting(meeting, reason = 'host_ended') {
  meeting.status = 'ended';
  meeting.endedAt = new Date();
  meeting.stats.endedReason = reason;
  const now = Date.now();
  (meeting.attendance || []).forEach((a) => {
    if (!a.leftAt) {
      a.leftAt = new Date();
      a.durationMs = (a.durationMs || 0) + Math.max(0, now - new Date(a.joinedAt).getTime());
    }
  });
  meeting.waiting = [];
  await meeting.save();
  return meeting;
}

function durationMs(meeting) {
  if (!meeting) return 0;
  if (meeting.startedAt && meeting.endedAt) return new Date(meeting.endedAt) - new Date(meeting.startedAt);
  return 0;
}

function assertHost(meeting, user, adminAllowed = true) {
  const hostOk = isHostOf(meeting, user);
  const adminOk = adminAllowed && user.role === 'admin';
  if (!hostOk && !adminOk) throw ApiError.forbidden('Only the host can do that');
}

module.exports = {
  getMeetingByCode,
  isHostOf,
  hasJoined,
  evaluateJoin,
  recordJoin,
  recordLeave,
  endMeeting,
  durationMs,
  assertHost,
  hashMeetingPassword,
  matchMeetingPassword,
};
