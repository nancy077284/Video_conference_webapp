const ROLE_HIERARCHY = { user: 0, moderator: 1, host: 2, admin: 3 };

function isHost(user, meeting) {
  if (!user || !meeting) return false;
  const uid = String(user._id || user.id || '');
  return String(meeting.host?._id || meeting.host || '') === uid;
}

function participantRole(user, meeting) {
  if (!user || !meeting) return 'participant';
  if (isHost(user, meeting)) return 'host';
  const entry = (meeting.attendance || []).find(
    (a) => String(a.user?._id || a.user || '') === String(user._id || user.id || '')
  );
  if (entry?.role === 'moderator') return 'moderator';
  return 'participant';
}

function isModerator(user, meeting) {
  const role = participantRole(user, meeting);
  return role === 'host' || role === 'moderator';
}

function canModerate(actor, meeting, targetRole) {
  const role = participantRole(actor, meeting);
  if (role === 'host') return true;
  if (role === 'moderator') return targetRole !== 'host';
  return false;
}

function canControl(actor, meeting, action) {
  const role = participantRole(actor, meeting);
  const privileged = role === 'host' || role === 'moderator';
  const allowed = [
    'mute',
    'remove',
    'promote',
    'demote',
    'lock',
    'waitingRoom',
    'allowChat',
    'allowScreenShare',
    'endMeeting',
    'admit',
    'reject',
  ];
  if (!privileged || !allowed.includes(action)) return false;
  if (role === 'moderator' && ['endMeeting', 'lock', 'waitingRoom'].includes(action)) return false;
  return true;
}

function meetsRole(required, actual) {
  return (ROLE_HIERARCHY[actual] ?? -1) >= (ROLE_HIERARCHY[required] ?? 99);
}

module.exports = {
  ROLE_HIERARCHY,
  isHost,
  participantRole,
  isModerator,
  canModerate,
  canControl,
  meetsRole,
};
