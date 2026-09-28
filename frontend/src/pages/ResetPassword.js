import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Alert, Link, Typography, Stack } from '@mui/material';
import api from '../services/api';
import AuthCard from '../components/AuthCard';
import { PasswordField } from './Login';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const token = params.get('token') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFields({});
    if (password !== confirm) {
      setFields({ confirm: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err?.message || 'Unable to reset password');
      if (err?.fields) setFields(err.fields);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Invalid reset link">
        <Alert severity="error">
          This password reset link is missing its token. Request a new link from the{' '}
          <Link component={RouterLink} to="/forgot-password">
            forgot password page
          </Link>
          .
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Your reset link expires 30 minutes after it was created."
      footer={
        <Link component={RouterLink} to="/login" underline="hover">
          Back to sign in
        </Link>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {done ? (
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
          <Typography variant="h6">Password updated</Typography>
          <Typography variant="body2" color="text.secondary">
            Redirecting you to the sign in page…
          </Typography>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <PasswordField
            fullWidth
            required
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={fields.password || 'At least 8 characters with a letter and a number'}
            error={Boolean(fields.password)}
            autoFocus
          />
          <PasswordField
            fullWidth
            required
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={Boolean(fields.confirm)}
            helperText={fields.confirm}
            sx={{ mt: 2 }}
          />
          <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 2.5 }} disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </Box>
      )}
    </AuthCard>
  );
};

export default ResetPassword;
