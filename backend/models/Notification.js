const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'meeting_invitation',
        'meeting_reminder',
        'meeting_cancelled',
        'meeting_started',
        'participant_joined',
        'recording_available',
        'system',
        'account',
      ],
      default: 'system',
    },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
