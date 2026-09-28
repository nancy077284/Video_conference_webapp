const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, default: '' },
    senderAvatar: { type: String, default: '' },
    kind: { type: String, enum: ['message', 'system'], default: 'message' },
    text: { type: String, required: true, maxlength: 2000 },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ meeting: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
