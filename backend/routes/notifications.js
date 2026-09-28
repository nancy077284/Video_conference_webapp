const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const ApiError = require('../utils/errors');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { user: req.user._id };
    if (req.query.unread === 'true') filter.read = false;

    const [items, unread, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments({ user: req.user._id, read: false }),
      Notification.countDocuments(filter),
    ]);

    res.json({ items, unreadCount: unread, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', auth, async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', auth, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notification) throw ApiError.notFound('Notification not found');
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', auth, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    if (!result.deletedCount) throw ApiError.notFound('Notification not found');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
