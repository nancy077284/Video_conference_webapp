const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: { type: String, enum: ['host', 'moderator', 'participant'], default: 'participant' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    connections: { type: Number, default: 1 },
  },
  { _id: true }
);

const recordingSchema = new mongoose.Schema(
  {
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedByName: String,
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    durationMs: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    fileName: String,
    status: {
      type: String,
      enum: ['recording', 'completed', 'upload_failed', 'uploaded'],
      default: 'recording',
    },
    note: String,
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, unique: true, index: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Meeting', maxlength: 140 },
    description: { type: String, default: '', maxlength: 1000 },
    type: { type: String, enum: ['instant', 'scheduled'], default: 'instant' },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    endsAt: Date,
    startedAt: Date,
    endedAt: Date,
    timezone: { type: String, default: 'UTC' },
    password: { type: String, select: false },
    waitingRoom: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    settings: {
      allowChat: { type: Boolean, default: true },
      allowScreenShare: { type: Boolean, default: true },
      allowRaiseHand: { type: Boolean, default: true },
      allowParticipantRecording: { type: Boolean, default: true },
      maxParticipants: { type: Number, default: 50 },
    },
    invitees: [
      {
        email: { type: String, lowercase: true, trim: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['invited', 'joined', 'declined'], default: 'invited' },
      },
    ],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attendance: [attendanceSchema],
    waiting: [
      {
        socketId: String,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    recordings: [recordingSchema],
    stats: {
      peakParticipants: { type: Number, default: 0 },
      totalJoins: { type: Number, default: 0 },
      chatMessages: { type: Number, default: 0 },
      endedReason: String,
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

meetingSchema.index({ host: 1, status: 1, scheduledAt: -1 });
meetingSchema.index({ 'attendance.user': 1, startedAt: -1 });
meetingSchema.index({ title: 'text', description: 'text' });

meetingSchema.methods.toPublic = function ({ host, forUser } = {}) {
  const isHost = forUser && host && String(this.host?._id || this.host) === String(forUser);
  return {
    id: this._id,
    _id: this._id,
    meetingId: this.meetingId,
    title: this.title,
    description: this.description || '',
    type: this.type,
    status: this.status,
    host: host || this.host,
    scheduledAt: this.scheduledAt,
    endsAt: this.endsAt,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    timezone: this.timezone,
    hasPassword: Boolean(this.password),
    waitingRoom: this.waitingRoom,
    locked: this.locked,
    settings: this.settings,
    invitees: this.invitees,
    participants: this.participants,
    attendance: this.attendance,
    recordings: this.recordings,
    stats: this.stats,
    participantCount: (this.attendance || []).length,
    createdAt: this.createdAt,
    canManage: Boolean(isHost),
    joinUrl: `/join/${this.meetingId}`,
  };
};

module.exports = mongoose.model('Meeting', meetingSchema);
