import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Alert, Link, Typography, Chip, Stack } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import api from '../services/api';
import AuthCard from '../components/AuthCard';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.forgotPassword(email.trim());
      setSent(true);
      setDevUrl(data.devResetUrl || null);
    } catch (err) {
      setError(err?.message || 'Unable to process that request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will generate a secure reset link for your account."
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
      {sent ? (
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
          <MarkEmailReadIcon color="success" sx={{ fontSize: 48 }} />
          <Typography variant="h6">Check your notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            If an account exists for <strong>{email}</strong>, a reset link was created and expires in
            30 minutes.
          </Typography>
          {devUrl && (
            <Box sx={{ width: '100%' }}>
              <Chip label="Development mode" color="warning" size="small" sx={{ mb: 1 }} />
              <Alert severity="info" sx={{ textAlign: 'left', wordBreak: 'break-all' }}>
                Email delivery is not configured locally. Open{' '}
                <Link href={devUrl} underline="always">
                  this reset link
                </Link>{' '}
                to continue.
              </Alert>
            </Box>
          )}
          <Button component={RouterLink} to="/login" variant="outlined">
            Return to sign in
          </Button>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            required
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 2.5 }}
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </Box>
      )}
    </AuthCard>
  );
};

export default ForgotPassword;
