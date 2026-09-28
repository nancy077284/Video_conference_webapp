const express = require('express');
const crypto = require('crypto');
const Meeting = require('../models/Meeting');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/create', auth, async (req, res) => {
  try {
    const meetingId = crypto.randomBytes(4).toString('hex');
    const meeting = new Meeting({
      meetingId,
      host: req.user._id,
      title: req.body.title || 'Meeting',
      participants: [req.user._id],
    });
    await meeting.save();
    res.status(201).json({ meeting });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join/:meetingId', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (!meeting.participants.includes(req.user._id)) {
      meeting.participants.push(req.user._id);
      await meeting.save();
    }
    res.json({ meeting });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:meetingId', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json({ meeting });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
