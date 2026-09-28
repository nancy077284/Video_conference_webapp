import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Container, Paper, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../context/AuthContext';

export const FullScreenLoader = ({ label = 'Loading…' }) => (
  <Box
    sx={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    }}
    role="status"
    aria-live="polite"
  >
    <CircularProgress />
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

export const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
};

export const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;
  return children;
};

export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

export const Unauthorized = () => {
  const { isAdmin } = useAuth();
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
        <LockIcon color="error" sx={{ fontSize: 48 }} />
        <Typography variant="h5" sx={{ mt: 2 }}>
          Access denied
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          You need administrator permissions to open this page. Your current role does not grant
          access to the admin console.
        </Typography>
        <Button variant="contained" sx={{ mt: 3 }} href={isAdmin ? '/admin' : '/dashboard'}>
          Go back
        </Button>
      </Paper>
    </Container>
  );
};

export default PrivateRoute;
