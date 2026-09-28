const express = require('express');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { escapeRegExp } = require('../utils/sanitize');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.json({ meetings: [], users: [] });
    const rx = new RegExp(escapeRegExp(q), 'i');
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const [meetings, users] = await Promise.all([
      Meeting.find(
        isAdmin
          ? { $or: [{ title: rx }, { meetingId: rx }] }
          : {
              $and: [
                { $or: [{ host: userId }, { participants: userId }] },
                { $or: [{ title: rx }, { meetingId: rx }] },
              ],
            }
      )
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate('host', 'name email avatar'),
      isAdmin
        ? User.find({ $or: [{ name: rx }, { email: rx }, { username: rx }] })
            .select('name email avatar role status')
            .limit(6)
        : Promise.resolve([]),
    ]);

    res.json({
      meetings: meetings.map((m) => m.toPublic({ forUser: userId })),
      users,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
