const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true, maxlength: 30 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
    preferences: {
      notifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      meetingReminders: { type: Boolean, default: true },
      joinAudioMuted: { type: Boolean, default: false },
      joinVideoOff: { type: Boolean, default: false },
      preferredMicrophone: { type: String, default: '' },
      preferredCamera: { type: String, default: '' },
      preferredSpeaker: { type: String, default: '' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    resetToken: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    meetingStats: {
      hosted: { type: Number, default: 0 },
      attended: { type: Number, default: 0 },
      totalDurationMs: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: 1 });
userSchema.index({ lastActiveAt: -1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    username: this.username || '',
    email: this.email,
    role: this.role,
    status: this.status,
    avatar: this.avatar || '',
    bio: this.bio || '',
    timezone: this.timezone,
    language: this.language,
    preferences: this.preferences,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
    meetingStats: this.meetingStats,
  };
};

module.exports = mongoose.model('User', userSchema);
