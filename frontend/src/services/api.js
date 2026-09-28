const API_BASE =
  process.env.REACT_APP_API_URL ||
  (window.location.port === '3000' ? 'http://localhost:5001/api' : '/api');

export class ApiError extends Error {
  constructor(status, message, code, fields) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'ERROR';
    this.fields = fields || null;
  }
}

const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

const STATUS_MESSAGES = {
  400: 'Please check the information you entered and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'That action conflicts with the current state.',
  422: 'Some of the information provided is not valid.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again.',
  502: 'The server is restarting. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again.',
};

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

function emitExpired() {
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

async function request(path, { method = 'GET', body, signal, auth = true, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(0, NETWORK_MESSAGE, 'NETWORK');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      if (raw) return text;
      if (res.ok) throw new ApiError(res.status, 'Received an invalid response from the server.', 'PARSE');
    }
  }

  if (!res.ok) {
    const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));
    if (res.status === 401 && token && !isAuthPath) emitExpired();
    const message = (data && data.error) || STATUS_MESSAGES[res.status] || 'Request failed';
    throw new ApiError(res.status, message, data?.code, data?.fields);
  }

  if (raw) return text;
  return data === null ? {} : data;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

const api = {
  base: API_BASE,
  getToken: () => localStorage.getItem('token'),
  setToken: (token) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),

  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }).catch(() => {}),
  getMe: () => request('/auth/me'),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload, auth: false }),
  changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: payload }),
  updateProfile: (payload) => request('/auth/profile', { method: 'PUT', body: payload }),
  getStats: () => request('/auth/stats'),

  // Meetings
  createMeeting: (title) => request('/meetings/create', { method: 'POST', body: { title } }),
  scheduleMeeting: (payload) => request('/meetings/schedule', { method: 'POST', body: payload }),
  getDashboard: () => request('/meetings/dashboard'),
  listMeetings: (params) => request(`/meetings${qs(params)}`),
  getMeeting: (meetingId) => request(`/meetings/${meetingId}`),
  updateMeeting: (meetingId, payload) => request(`/meetings/${meetingId}`, { method: 'PATCH', body: payload }),
  deleteMeeting: (meetingId, permanent = false) =>
    request(`/meetings/${meetingId}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
  clearMeetingHistory: () => request('/meetings/history/clear', { method: 'DELETE' }),
  joinMeeting: (meetingId, password) =>
    request(`/meetings/${meetingId}/join`, { method: 'POST', body: { password } }),
  leaveMeeting: (meetingId) => request(`/meetings/${meetingId}/leave`, { method: 'POST' }),
  endMeeting: (meetingId) => request(`/meetings/${meetingId}/end`, { method: 'POST' }),
  getMessages: (meetingId) => request(`/meetings/${meetingId}/messages`),
  registerRecording: (meetingId, payload) =>
    request(`/meetings/${meetingId}/recordings`, { method: 'POST', body: payload }),

  // Notifications
  listNotifications: (params) => request(`/notifications${qs(params)}`),
  unreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),

  // Search
  search: (q) => request(`/search${qs({ q })}`),

  // Admin
  adminStats: () => request('/admin/stats'),
  adminAnalytics: (days) => request(`/admin/analytics${qs({ days })}`),
  adminUsers: (params) => request(`/admin/users${qs(params)}`),
  adminUser: (id) => request(`/admin/users/${id}`),
  adminUpdateUser: (id, payload) => request(`/admin/users/${id}`, { method: 'PATCH', body: payload }),
  adminMeetings: (params) => request(`/admin/meetings${qs(params)}`),
  adminMeeting: (id) => request(`/admin/meetings/${id}`),
  adminEndMeeting: (id) => request(`/admin/meetings/${id}/end`, { method: 'POST' }),
  adminCancelMeeting: (id) => request(`/admin/meetings/${id}/cancel`, { method: 'POST' }),
  adminAudit: (params) => request(`/admin/audit${qs(params)}`),
};

export default api;
