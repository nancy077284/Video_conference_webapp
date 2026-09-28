const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: { type: String, default: 'System' },
    action: { type: String, required: true, index: true },
    target: { type: mongoose.Schema.Types.Mixed },
    targetType: { type: String, index: true },
    result: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
