const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const Meeting = require('../models/Meeting');
const Message = require('../models/Message');
const User = require('../models/User');
const { config } = require('../config/env');
const { logAudit } = require('../utils/audit');
const { notifyUser, notifyMany } = require('../utils/notify');
const service = require('../services/meetingService');
const { cleanText, clip } = require('../utils/sanitize');

const MAX_CHAT_LEN = 2000;
const MAX_PARTICIPANTS = () => config.maxParticipants;

/** roomId -> { meetingId, meeting, participants: Map, waiting: Map, settings, messages } */
const rooms = new Map();

function publicParticipant(p) {
  return {
    socketId: p.socketId,
    userId: p.userId,
    name: p.name,
    avatar: p.avatar || '',
    role: p.role,
    muted: p.muted,
    videoOff: p.videoOff,
    handRaised: p.handRaised,
    screenSharing: p.screenSharing,
    quality: p.quality,
    joinedAt: p.joinedAt,
    speaking: p.speaking,
  };
}

function roomSnapshot(room) {
  return {
    meetingId: room.meetingId,
    participants: [...room.participants.values()].map(publicParticipant),
    waiting: [...room.waiting.values()].map((w) => ({
      socketId: w.socketId,
      userId: w.userId,
      name: w.name,
      avatar: w.avatar || '',
      requestedAt: w.requestedAt,
    })),
    settings: room.settings,
    hostUserId: room.hostUserId,
    activeSpeakerId: room.activeSpeakerId,
  };
}

function getRoom(meetingId) {
  return rooms.get(meetingId);
}

function ensureRoom(meeting, meetingId) {
  let room = rooms.get(meetingId);
  if (!room) {
    room = {
      meetingId,
      meetingIdDb: meeting._id,
      hostUserId: String(meeting.host?._id || meeting.host),
      participants: new Map(),
      waiting: new Map(),
      activeSpeakerId: null,
      settings: {
        allowChat: meeting.settings?.allowChat !== false,
        allowScreenShare: meeting.settings?.allowScreenShare !== false,
        allowRaiseHand: meeting.settings?.allowRaiseHand !== false,
        locked: Boolean(meeting.locked),
        waitingRoom: Boolean(meeting.waitingRoom),
        maxParticipants: meeting.settings?.maxParticipants || config.maxParticipants,
      },
      createdBy: String(meeting.host?._id || meeting.host),
    };
    rooms.set(meetingId, room);
  }
  return room;
}

function participantByUserId(room, userId) {
  for (const p of room.participants.values()) {
    if (p.userId === String(userId)) return p;
  }
  return null;
}

async function persistSystemMessage(room, text) {
  try {
    const doc = await Message.create({
      meeting: room.meetingIdDb,
      kind: 'system',
      senderName: '',
      text: clip(cleanText(text, 500), 500),
    });
    return doc;
  } catch (err) {
    console.error('[socket] system message failed:', err.message);
    return null;
  }
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, config.jwtSecret);
          const user = await User.findById(decoded.userId);
          if (user && user.status !== 'suspended') {
            socket.data.user = {
              id: String(user._id),
              name: user.name,
              email: user.email,
              avatar: user.avatar || '',
              role: user.role,
            };
            return next();
          }
        } catch (jwtErr) {
          // Token expired or signature mismatch; proceed to fallback
        }
      }

      const authUser = socket.handshake.auth?.user || socket.handshake.query?.user;
      let parsedUser = {};
      if (typeof authUser === 'string') {
        try { parsedUser = JSON.parse(authUser); } catch (e) {}
      } else if (typeof authUser === 'object' && authUser !== null) {
        parsedUser = authUser;
      }

      const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId || parsedUser.id || parsedUser._id || socket.id;
      const userName = socket.handshake.auth?.userName || socket.handshake.query?.userName || parsedUser.name || 'Participant';

      socket.data.user = {
        id: String(userId),
        name: String(userName),
        email: parsedUser.email || '',
        avatar: parsedUser.avatar || '',
        role: 'participant',
      };
      next();
    } catch (err) {
      socket.data.user = {
        id: socket.id,
        name: 'Participant',
        email: '',
        avatar: '',
        role: 'participant',
      };
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    let currentRoomId = null;

    // WebRTC room joining (used by Room.js)
    socket.on('join-room', async ({ roomId, userId, userName } = {}) => {
      try {
        const meetingId = String(roomId || '').trim();
        if (!meetingId) return;

        currentRoomId = meetingId;
        socket.data.roomId = meetingId;
        socket.data.userId = String(userId || user?.id || socket.id);
        socket.data.userName = userName || user?.name || 'Participant';
        socket.join(meetingId);

        // Fetch all other sockets in room
        const socketsInRoom = await io.in(meetingId).fetchSockets();
        const existingUsers = socketsInRoom
          .filter((s) => s.id !== socket.id)
          .map((s) => ({
            socketId: s.id,
            userId: s.data.userId || s.data.user?.id || s.id,
            userName: s.data.userName || s.data.user?.name || 'Participant',
          }));

        // Send existing participants to the joining client
        socket.emit('room-users', existingUsers);

        // Notify other participants that a new user joined
        socket.to(meetingId).emit('user-joined', {
          socketId: socket.id,
          userId: socket.data.userId,
          userName: socket.data.userName,
        });

        // Ensure database state is updated (meeting is live & user is recorded)
        try {
          const meeting = await Meeting.findOne({ meetingId });
          if (meeting) {
            if (meeting.status === 'scheduled') {
              meeting.status = 'live';
              meeting.startedAt = meeting.startedAt || new Date();
            }
            if (user?.id && !meeting.participants.some((p) => String(p) === String(user.id))) {
              meeting.participants.push(user.id);
            }
            await meeting.save();
          }
        } catch (dbErr) {
          console.warn('[socket] db update on join-room:', dbErr.message);
        }
      } catch (err) {
        console.error('[socket] join-room error:', err);
      }
    });

    // WebRTC signaling
    socket.on('offer', ({ to, offer, from } = {}) => {
      if (!to || !offer) return;
      io.to(to).emit('offer', { offer, from: from || socket.id });
    });

    socket.on('answer', ({ to, answer, from } = {}) => {
      if (!to || !answer) return;
      io.to(to).emit('answer', { answer, from: from || socket.id });
    });

    socket.on('ice-candidate', ({ to, candidate, from } = {}) => {
      if (!to || !candidate) return;
      io.to(to).emit('ice-candidate', { candidate, from: from || socket.id });
    });

    // In-room Chat
    socket.on('chat-message', ({ roomId, message } = {}) => {
      const targetRoom = roomId || socket.data.roomId;
      if (!targetRoom || !message) return;
      io.to(targetRoom).emit('chat-message', {
        message,
        from: socket.id,
        timestamp: Date.now(),
      });
    });

    // Hand raise
    socket.on('hand-raise', ({ roomId, userId, raised } = {}) => {
      const targetRoom = roomId || socket.data.roomId;
      if (!targetRoom) return;
      io.to(targetRoom).emit('hand-raise', {
        userId: userId || socket.data.userId || socket.id,
        raised: Boolean(raised),
        socketId: socket.id,
      });
    });

    // Leave room
    socket.on('leave-room', ({ roomId } = {}) => {
      const targetRoom = roomId || socket.data.roomId;
      if (targetRoom) {
        socket.leave(targetRoom);
        socket.to(targetRoom).emit('user-left', { socketId: socket.id, userId: socket.data.userId });
      }
    });

    // End room (terminates meeting for everyone)
    socket.on('end-room', ({ roomId } = {}) => {
      const targetRoom = roomId || socket.data.roomId;
      if (targetRoom) {
        io.to(targetRoom).emit('room:ended', { reason: 'The host ended the meeting' });
        io.to(targetRoom).emit('meeting-ended', { reason: 'The host ended the meeting' });
      }
    });

    socket.on('room:join', async (payload = {}, ack) => {
      try {
        const meetingId = String(payload.meetingId || '');
        const meeting = await Meeting.findOne({ meetingId }).select('+password').populate('host', 'name email avatar');
        const verdict = service.evaluateJoin(meeting, user, { password: payload.password });

        if (!verdict.allowed && !verdict.waiting) {
          const err = { code: verdict.reason, message: verdict.message };
          if (typeof ack === 'function') ack({ ok: false, ...err });
          return socket.emit('room:error', err);
        }

        const room = ensureRoom(meeting, meetingId);

        if (room.settings.locked && !service.isHostOf(meeting, user)) {
          const err = { code: 'locked', message: 'This meeting is locked by the host' };
          if (typeof ack === 'function') ack({ ok: false, ...err });
          return socket.emit('room:error', err);
        }
        if (room.participants.size >= Math.min(room.settings.maxParticipants, MAX_PARTICIPANTS()) && !service.isHostOf(meeting, user)) {
          const err = { code: 'full', message: 'This meeting is full' };
          if (typeof ack === 'function') ack({ ok: false, ...err });
          return socket.emit('room:error', err);
        }

        // Waiting room path
        if (verdict.waiting || (room.settings.waitingRoom && !service.isHostOf(meeting, user))) {
          room.waiting.set(socket.id, {
            socketId: socket.id,
            userId: user.id,
            name: user.name,
            avatar: user.avatar,
            requestedAt: new Date(),
          });
          socket.data.roomId = meetingId;
          socket.join(`waiting:${meetingId}`);
          if (typeof ack === 'function') ack({ ok: false, waiting: true, code: 'waiting_room', message: verdict.message });
          io.to(`host:${meetingId}`).emit('room:waiting-updated', roomSnapshot(room).waiting);
          io.to(`host:${meetingId}`).emit('room:state', roomSnapshot(room));
          return;
        }

        await joinRoom(room, meeting, socket, payload, ack);
      } catch (err) {
        console.error('[socket] join error:', err);
        const errPayload = { code: 'server_error', message: 'Unable to join the meeting' };
        if (typeof ack === 'function') ack({ ok: false, ...errPayload });
        socket.emit('room:error', errPayload);
      }
    });

    async function joinRoom(room, meeting, socket, payload, ack) {
      const isHostUser = service.isHostOf(meeting, user);
      const existing = participantByUserId(room, user.id);

      // Duplicate join from same user (second tab / refresh) - replace old session
      if (existing && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          oldSocket.emit('room:duplicate', { message: 'You joined from another tab or device.' });
          oldSocket.data.roomId = null;
          oldSocket.leave(room.meetingId);
        }
        room.participants.delete(existing.socketId);
        io.to(room.meetingId).emit('room:participant-left', { socketId: existing.socketId });
      }

      const participant = {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        role: isHostUser ? 'host' : (meeting.attendance || []).find((a) => String(a.user?._id || a.user) === user.id)?.role === 'moderator' ? 'moderator' : 'participant',
        muted: Boolean(payload.muted),
        videoOff: Boolean(payload.videoOff),
        handRaised: false,
        screenSharing: false,
        quality: 'good',
        joinedAt: Date.now(),
        speaking: false,
      };

      room.participants.set(socket.id, participant);
      room.waiting.delete(socket.id);
      currentRoomId = room.meetingId;
      socket.data.roomId = room.meetingId;
      socket.data.meetingIdDb = room.meetingIdDb;
      socket.join(room.meetingId);
      if (isHostUser) socket.join(`host:${room.meetingId}`);
      socket.leave(`waiting:${room.meetingId}`);

      try {
        await service.recordJoin(meeting, user);
      } catch (err) {
        console.error('[socket] recordJoin failed:', err.message);
      }

      const systemDoc = await persistSystemMessage(room, `${user.name} joined the meeting`);
      if (systemDoc) {
        socket.to(room.meetingId).emit('chat:message', systemDoc);
      }
      if (!isHostUser) {
        notifyUser(room.hostUserId, {
          type: 'participant_joined',
          title: `${user.name} joined "${meeting.title}"`,
          link: `/meetings/${meeting.meetingId}`,
        }).catch(() => {});
      }

      const snapshot = roomSnapshot(room);
      socket.emit('room:joined', {
        ...snapshot,
        self: participant,
        meeting: {
          meetingId: room.meetingId,
          title: meeting.title,
          hostName: meeting.host?.name || '',
          hostId: room.hostUserId,
          status: meeting.status,
          iceServers: config.iceServers,
        },
      });
      socket.to(room.meetingId).emit('room:participant-joined', publicParticipant(participant));
      io.to(`host:${room.meetingId}`).emit('room:waiting-updated', snapshot.waiting);
      io.to(`host:${room.meetingId}`).emit('room:state', snapshot);
      if (typeof ack === 'function') ack({ ok: true, meetingId: room.meetingId });
    }

    socket.on('signal:offer', ({ to, sdp } = {}) => {
      if (!to || !sdp) return;
      io.to(to).emit('signal:offer', { from: socket.id, sdp });
    });

    socket.on('signal:answer', ({ to, sdp } = {}) => {
      if (!to || !sdp) return;
      io.to(to).emit('signal:answer', { from: socket.id, sdp });
    });

    socket.on('signal:candidate', ({ to, candidate } = {}) => {
      if (!to || !candidate) return;
      io.to(to).emit('signal:candidate', { from: socket.id, candidate });
    });

    socket.on('chat:send', async (payload = {}) => {
      const roomId = socket.data.roomId;
      const room = getRoom(roomId);
      if (!room) return;
      if (!room.settings.allowChat && !isPrivileged(room)) {
        return socket.emit('room:error', { code: 'chat_disabled', message: 'Chat is disabled by the host' });
      }
      const text = clip(cleanText(payload.text || '', MAX_CHAT_LEN), MAX_CHAT_LEN);
      if (!text) return;
      try {
        const doc = await Message.create({
          meeting: room.meetingIdDb,
          sender: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          kind: 'message',
          text,
        });
        io.to(room.meetingId).emit('chat:message', doc);
      } catch (err) {
        console.error('[socket] chat persist failed:', err.message);
        socket.emit('chat:failed', { text, message: 'Message could not be sent' });
      }
    });

    socket.on('hand:toggle', (payload = {}) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      if (!room.settings.allowRaiseHand && !isPrivileged(room)) {
        return socket.emit('room:error', { code: 'hand_disabled', message: 'Raise hand is disabled by the host' });
      }
      const p = room.participants.get(socket.id);
      if (!p) return;
      p.handRaised = Boolean(payload.raised);
      io.to(room.meetingId).emit('hand:changed', { socketId: socket.id, userId: user.id, raised: p.handRaised });
      io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
    });

    socket.on('reaction:send', (payload = {}) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      const allowed = ['👍', '👏', '❤️', '😂', '🎉', '😮'];
      if (!allowed.includes(payload.emoji)) return;
      io.to(room.meetingId).emit('reaction', {
        emoji: payload.emoji,
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        at: Date.now(),
      });
    });

    socket.on('media:state', (payload = {}) => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      const p = room.participants.get(socket.id);
      if (!p) return;
      if (typeof payload.muted === 'boolean') p.muted = payload.muted;
      if (typeof payload.videoOff === 'boolean') p.videoOff = payload.videoOff;
      if (typeof payload.speaking === 'boolean') {
        p.speaking = payload.speaking;
        if (payload.speaking) {
          room.activeSpeakerId = socket.id;
          io.to(room.meetingId).emit('active-speaker', { socketId: socket.id, userId: user.id });
        }
      }
      if (payload.quality && ['good', 'fair', 'poor'].includes(payload.quality)) p.quality = payload.quality;
      if (payload.reconnect) p.quality = 'good';
      io.to(room.meetingId).emit('media:changed', {
        socketId: socket.id,
        muted: p.muted,
        videoOff: p.videoOff,
        quality: p.quality,
      });
    });

    socket.on('screen:started', async () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      if (!room.settings.allowScreenShare && !isPrivileged(room)) {
        return socket.emit('room:error', { code: 'screen_disabled', message: 'Screen sharing is disabled by the host' });
      }
      const p = room.participants.get(socket.id);
      if (p) p.screenSharing = true;
      io.to(room.meetingId).emit('screen:started', { socketId: socket.id, userId: user.id, name: user.name });
      const doc = await persistSystemMessage(room, `${user.name} started screen sharing`);
      if (doc) io.to(room.meetingId).emit('chat:message', doc);
    });

    socket.on('screen:stopped', async () => {
      const room = getRoom(socket.data.roomId);
      if (!room) return;
      const p = room.participants.get(socket.id);
      if (p) p.screenSharing = false;
      io.to(room.meetingId).emit('screen:stopped', { socketId: socket.id });
      const doc = await persistSystemMessage(room, `${user.name} stopped screen sharing`);
      if (doc) io.to(room.meetingId).emit('chat:message', doc);
    });

    socket.on('host:action', async (payload = {}, ack) => {
      try {
        const result = await handleHostAction(payload);
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (err) {
        const body = { ok: false, code: err.code || 'error', message: err.message || 'Action failed' };
        if (typeof ack === 'function') ack(body);
        else socket.emit('room:error', body);
      }
    });

    function isPrivileged(room) {
      const p = room?.participants.get(socket.id);
      return p && (p.role === 'host' || p.role === 'moderator');
    }

    async function handleHostAction({ action, targetSocketId, value } = {}) {
      const room = getRoom(socket.data.roomId);
      if (!room) throw Object.assign(new Error('Meeting not found'), { code: 'not_found' });
      const actor = room.participants.get(socket.id);
      if (!actor || (actor.role !== 'host' && actor.role !== 'moderator')) {
        throw Object.assign(new Error('Only the host or a moderator can do that'), { code: 'forbidden' });
      }

      switch (action) {
        case 'mute': {
          const target = room.participants.get(targetSocketId);
          if (!target) throw Object.assign(new Error('Participant not found'), { code: 'not_found' });
          if (target.role === 'host' && actor.role !== 'host') {
            throw Object.assign(new Error('You cannot mute the host'), { code: 'forbidden' });
          }
          target.muted = true;
          io.to(targetSocketId).emit('host:force-mute', { by: actor.name });
          io.to(room.meetingId).emit('media:changed', { socketId: target.socketId, muted: true, videoOff: target.videoOff });
          return { targetSocketId, muted: true };
        }
        case 'remove': {
          const target = room.participants.get(targetSocketId);
          if (!target) throw Object.assign(new Error('Participant not found'), { code: 'not_found' });
          if (target.role === 'host') throw Object.assign(new Error('Cannot remove the host'), { code: 'forbidden' });
          if (target.userId === actor.userId) throw Object.assign(new Error('You cannot remove yourself'), { code: 'bad_request' });
          io.to(targetSocketId).emit('host:removed', { by: actor.name });
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          await leaveRoom(targetSocket, room, 'removed');
          if (targetSocket) {
            targetSocket.leave(room.meetingId);
            targetSocket.data.roomId = null;
          }
          const doc = await persistSystemMessage(room, `${target.name} was removed from the meeting`);
          if (doc) io.to(room.meetingId).emit('chat:message', doc);
          io.to(room.meetingId).emit('room:participant-left', { socketId: targetSocketId });
          io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
          return { targetSocketId };
        }
        case 'promote':
        case 'demote': {
          const target = room.participants.get(targetSocketId);
          if (!target) throw Object.assign(new Error('Participant not found'), { code: 'not_found' });
          if (target.role === 'host') throw Object.assign(new Error('Cannot change the host role'), { code: 'forbidden' });
          if (actor.role === 'moderator') throw Object.assign(new Error('Only the host can change roles'), { code: 'forbidden' });
          target.role = action === 'promote' ? 'moderator' : 'participant';
          io.to(targetSocketId).emit('role:changed', { role: target.role });
          io.to(room.meetingId).emit('media:changed', { socketId: target.socketId, role: target.role });
          io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
          return { targetSocketId, role: target.role };
        }
        case 'lock': {
          if (actor.role !== 'host') throw Object.assign(new Error('Only the host can lock'), { code: 'forbidden' });
          room.settings.locked = Boolean(value);
          await Meeting.updateOne({ _id: room.meetingIdDb }, { $set: { locked: room.settings.locked } });
          io.to(room.meetingId).emit('settings:updated', room.settings);
          io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
          return { settings: room.settings };
        }
        case 'waitingRoom': {
          if (actor.role !== 'host') throw Object.assign(new Error('Only the host can change the waiting room'), { code: 'forbidden' });
          room.settings.waitingRoom = Boolean(value);
          await Meeting.updateOne({ _id: room.meetingIdDb }, { $set: { waitingRoom: room.settings.waitingRoom } });
          io.to(room.meetingId).emit('settings:updated', room.settings);
          io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
          if (!room.settings.waitingRoom) {
            const waitingEntries = [...room.waiting.values()];
            for (const entry of waitingEntries) {
              await admitWaiting(room, entry.socketId, actor);
            }
          }
          return { settings: room.settings };
        }
        case 'allowChat':
        case 'allowScreenShare': {
          const key = action === 'allowChat' ? 'allowChat' : 'allowScreenShare';
          if (actor.role !== 'host' && actor.role !== 'moderator') {
            throw Object.assign(new Error('Not allowed'), { code: 'forbidden' });
          }
          room.settings[key] = Boolean(value);
          await Meeting.updateOne({ _id: room.meetingIdDb }, { $set: { [`settings.${key}`]: room.settings[key] } });
          io.to(room.meetingId).emit('settings:updated', room.settings);
          io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));
          return { settings: room.settings };
        }
        case 'admit': {
          const entry = room.waiting.get(targetSocketId) || room.waiting.get(value);
          if (!entry) throw Object.assign(new Error('No one is waiting'), { code: 'not_found' });
          await admitWaiting(room, entry.socketId, actor);
          return { admitted: true };
        }
        case 'reject': {
          const entry = room.waiting.get(targetSocketId) || room.waiting.get(value);
          if (!entry) throw Object.assign(new Error('No one is waiting'), { code: 'not_found' });
          room.waiting.delete(entry.socketId);
          io.to(entry.socketId).emit('room:rejected', { message: 'The host denied your request to join' });
          io.to(`host:${room.meetingId}`).emit('room:waiting-updated', roomSnapshot(room).waiting);
          return { rejected: true };
        }
        case 'endMeeting': {
          if (actor.role !== 'host') throw Object.assign(new Error('Only the host can end the meeting'), { code: 'forbidden' });
          const meeting = await Meeting.findOne({ _id: room.meetingIdDb }).select('+password');
          if (meeting && meeting.status !== 'ended') await service.endMeeting(meeting, 'host_ended');
          io.to(room.meetingId).emit('room:ended', { reason: 'The host ended the meeting' });
          io.to(room.meetingId).emit('room:state', { ...roomSnapshot(room), ended: true });
          const sockets = await io.in(room.meetingId).fetchSockets();
          sockets.forEach((s) => {
            s.leave(room.meetingId);
            s.data.roomId = null;
          });
          const doc = await persistSystemMessage(room, 'The host ended the meeting');
          if (doc) io.to(room.meetingId).emit('chat:message', doc);
          await logAudit({ actor: actor.userId, action: 'meeting.ended', target: room.meetingId, targetType: 'meeting' });
          rooms.delete(room.meetingId);
          return { ended: true };
        }
        case 'toggleWaitingEntry': {
          return { waiting: roomSnapshot(room).waiting };
        }
        default:
          throw Object.assign(new Error('Unknown action'), { code: 'bad_request' });
      }
    }

    async function admitWaiting(room, waitingSocketId, actor) {
      const entry = room.waiting.get(waitingSocketId);
      if (!entry) return;
      room.waiting.delete(waitingSocketId);
      const targetSocket = io.sockets.sockets.get(waitingSocketId);
      if (!targetSocket) {
        io.to(`host:${room.meetingId}`).emit('room:waiting-updated', roomSnapshot(room).waiting);
        return;
      }
      targetSocket.emit('room:admitted', { by: actor.name });
      const meeting = await Meeting.findOne({ _id: room.meetingIdDb }).populate('host', 'name email avatar');
      if (!meeting) return;
      await joinRoom(room, meeting, targetSocket, {}, null);
      const doc = await persistSystemMessage(room, `${entry.name} was admitted by ${actor.name}`);
      if (doc) io.to(room.meetingId).emit('chat:message', doc);
    }

    async function leaveRoom(sock, room, reason = 'left') {
      if (!room || !sock) return;
      const p = room.participants.get(sock.id);
      if (!p) return;
      room.participants.delete(sock.id);
      if (room.activeSpeakerId === sock.id) room.activeSpeakerId = null;

      try {
        const meeting = await Meeting.findOne({ _id: room.meetingIdDb });
        if (meeting) await service.recordLeave(meeting, p.userId);
      } catch (err) {
        console.error('[socket] recordLeave failed:', err.message);
      }

      if (reason !== 'removed') {
        const doc = await persistSystemMessage(room, `${p.name} left the meeting`);
        if (doc) io.to(room.meetingId).emit('chat:message', doc);
      }
      io.to(room.meetingId).emit('room:participant-left', { socketId: sock.id, reason });
      io.to(`host:${room.meetingId}`).emit('room:state', roomSnapshot(room));

      if (room.participants.size === 0 && room.waiting.size === 0) {
        rooms.delete(room.meetingId);
      }
    }

    socket.on('room:leave', async () => {
      const room = getRoom(socket.data.roomId);
      const roomId = socket.data.roomId;
      if (room) {
        room.waiting.delete(socket.id);
        await leaveRoom(socket, room, 'left');
        io.to(`host:${roomId}`).emit('room:waiting-updated', roomSnapshot(room).waiting);
      }
      socket.leave(roomId || '');
      socket.data.roomId = null;
      currentRoomId = null;
    });

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.to(roomId).emit('user-left', { socketId: socket.id, userId: socket.data.userId });
      }
      const room = getRoom(roomId);
      if (room) {
        room.waiting.delete(socket.id);
        await leaveRoom(socket, room, 'disconnected');
        io.to(`host:${room.meetingId}`).emit('room:waiting-updated', roomSnapshot(room).waiting);
      }
      if (currentRoomId && !rooms.has(currentRoomId)) {
        // room already cleaned up
      }
    });
  });

  return io;
}

module.exports = { initSocket, rooms };
