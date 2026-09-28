import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Alert,
  Link,
  Stack,
  Typography,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

import { useAuth } from '../context/AuthContext';
import { PasswordField } from './Login';
import AuthCard from '../components/AuthCard';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFields({});
    if (form.password !== form.confirmPassword) {
      setFields({ confirmPassword: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to create your account');
      if (err?.fields) setFields(err.fields);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join millions collaborating with crystal-clear HD video & audio."
      footer={
        <>
          Already have an account?{' '}
          <Link
            component={RouterLink}
            to="/login"
            underline="hover"
            sx={{ fontWeight: 700, color: 'primary.main' }}
          >
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={1}>
          <TextField
            margin="dense"
            required
            fullWidth
            label="Full name"
            name="name"
            autoComplete="name"
            autoFocus
            value={form.name}
            error={Boolean(fields.name)}
            helperText={fields.name}
            onChange={update('name')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="dense"
            required
            fullWidth
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            error={Boolean(fields.email)}
            helperText={fields.email}
            onChange={update('email')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlineIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
                </InputAdornment>
              ),
            }}
          />
          <PasswordField
            margin="dense"
            required
            fullWidth
            label="Password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            error={Boolean(fields.password)}
            helperText={fields.password || 'At least 8 characters with a letter and a number'}
            onChange={update('password')}
          />
          <PasswordField
            margin="dense"
            required
            fullWidth
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            error={Boolean(fields.confirmPassword)}
            helperText={fields.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </Stack>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          sx={{
            mt: 3,
            mb: 1.5,
            py: 1.3,
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddAlt1Icon />}
        >
          {loading ? 'Creating account…' : 'Create Free Account'}
        </Button>
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
          By continuing you agree to VidCon&apos;s privacy and acceptable use policy.
        </Typography>
      </Box>
    </AuthCard>
  );
};

export default Register;
