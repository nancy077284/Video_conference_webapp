const TAG_RE = /<[^>]*>/g;

function stripHtml(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(TAG_RE, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u0000/g, '')
    .trim();
}

function clip(value, max) {
  const str = typeof value === 'string' ? value : '';
  return str.length > max ? str.slice(0, max) : str;
}

function cleanText(value, max = 500) {
  return clip(stripHtml(value), max);
}

function cleanName(value, max = 60) {
  const cleaned = cleanText(value, max).replace(/\s+/g, ' ');
  return cleaned;
}

function cleanSubject(value, max = 140) {
  return cleanText(value, max);
}

function isEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim().toLowerCase());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { stripHtml, clip, cleanText, cleanName, cleanSubject, isEmail, escapeRegExp };
