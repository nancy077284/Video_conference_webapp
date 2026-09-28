import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar, Alert, Stack } from '@mui/material';

const ToastContext = createContext(null);

let idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      const id = (idCounter += 1);
      const toast = {
        id,
        message: String(message || ''),
        severity: options.severity || 'info',
        duration: options.duration ?? (options.severity === 'error' ? 6000 : 4000),
        action: options.action,
      };
      setToasts((prev) => [...prev.slice(-3), toast]);
      return id;
    },
    []
  );

  const api = useMemo(
    () => ({
      push,
      success: (m, o) => push(m, { ...o, severity: 'success' }),
      error: (m, o) => push(m, { ...o, severity: 'error' }),
      info: (m, o) => push(m, { ...o, severity: 'info' }),
      warning: (m, o) => push(m, { ...o, severity: 'warning' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Stack spacing={1.5} sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, width: 360, maxWidth: 'calc(100vw - 32px)' }}>
        {toasts.map((toast) => (
          <Snackbar
            key={toast.id}
            open
            autoHideDuration={toast.duration}
            onClose={() => dismiss(toast.id)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={() => dismiss(toast.id)}
              severity={toast.severity}
              variant="filled"
              sx={{ width: '100%', alignItems: 'flex-start', boxShadow: 6 }}
            >
              {toast.message}
            </Alert>
          </Snackbar>
        ))}
      </Stack>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
