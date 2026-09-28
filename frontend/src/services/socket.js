import { io } from 'socket.io-client';

let socket = null;
let listenersBound = false;

const getSocketUrl = () =>
  process.env.REACT_APP_SOCKET_URL ||
  (window.location.port === '3000' ? 'http://localhost:5001' : window.location.origin);

export function getSocket() {
  if (socket && socket.connected) return socket;
  return socket;
}

export function connectSocket() {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  const token = localStorage.getItem('token');
  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    timeout: 10000,
    autoConnect: true,
  });
  return socket;
}

export function refreshSocketAuth() {
  if (socket) socket.auth = { token: localStorage.getItem('token') };
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    listenersBound = false;
  }
}

/**
 * Registers a listener exactly once per (event, handler) pair and returns an
 * unsubscribe function, so effects never accumulate duplicate listeners.
 */
export function onSocket(event, handler) {
  const s = connectSocket();
  s.on(event, handler);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    s.off(event, handler);
  };
}

export function emitSocket(event, payload, ack) {
  const s = connectSocket();
  if (!s.connected) {
    s.once('connect', () => s.emit(event, payload, ack));
    return s;
  }
  s.emit(event, payload, ack);
  return s;
}
