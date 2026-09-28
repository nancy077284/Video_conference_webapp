const { isEmail, cleanName, cleanSubject, cleanText } = require('./sanitize');

const PASSWORD_MIN = 8;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  if (password.length > 128) return 'Password is too long';
  return null;
}

function validateRegister({ name, email, password }) {
  const errors = {};
  if (!name || cleanName(name).length < 2) errors.name = 'Please enter your full name';
  if (!isEmail(email)) errors.email = 'Please enter a valid email address';
  const pwError = validatePassword(password);
  if (pwError) errors.password = pwError;
  return Object.keys(errors).length ? errors : null;
}

function parseEmailList(list) {
  if (!Array.isArray(list)) return { invalid: [], valid: [] };
  const valid = [];
  const invalid = [];
  const seen = new Set();
  list.forEach((raw) => {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) return;
    if (!isEmail(email) || seen.has(email)) {
      if (!seen.has(email)) invalid.push(email);
      return;
    }
    seen.add(email);
    valid.push(email);
  });
  return { valid, invalid };
}

function validateSchedule(payload = {}) {
  const errors = {};
  const title = cleanSubject(payload.title || '', 140);
  if (!title) errors.title = 'Meeting title is required';

  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    errors.scheduledAt = 'A valid date and time is required';
  } else if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
    errors.scheduledAt = 'Meeting cannot be scheduled in the past';
  }

  let endsAt = null;
  if (payload.endsAt) {
    endsAt = new Date(payload.endsAt);
    if (Number.isNaN(endsAt.getTime())) errors.endsAt = 'A valid end time is required';
    else if (scheduledAt && endsAt.getTime() <= scheduledAt.getTime()) {
      errors.endsAt = 'End time must be after start time';
    } else if (scheduledAt && endsAt.getTime() - scheduledAt.getTime() > 24 * 60 * 60 * 1000) {
      errors.endsAt = 'Meeting duration cannot exceed 24 hours';
    }
  }

  if (payload.password && payload.password.length > 0) {
    if (payload.password.length < 4) errors.password = 'Password must be at least 4 characters';
    if (payload.password.length > 32) errors.password = 'Password must be 32 characters or fewer';
  }

  const { invalid } = parseEmailList(payload.invitees);
  if (invalid.length) errors.invitees = `Invalid email: ${invalid[0]}`;

  return Object.keys(errors).length ? { errors, title, scheduledAt, endsAt } : { title, scheduledAt, endsAt };
}

function isStrongEnoughForProfileBio(bio) {
  return cleanText(bio || '', 500);
}

module.exports = {
  PASSWORD_MIN,
  validatePassword,
  validateRegister,
  validateSchedule,
  parseEmailList,
  isStrongEnoughForProfileBio,
};
