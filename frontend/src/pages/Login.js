import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';

import { useAuth } from '../context/AuthContext';
import AuthCard from '../components/AuthCard';

export const PasswordField = ({ label = 'Password', ...rest }) => {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...rest}
      type={visible ? 'text' : 'password'}
      label={label}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <VpnKeyOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible((v) => !v)}
              edge="end"
            >
              {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, sessionExpired, dismissSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (sessionExpired) dismissSessionExpired();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFields({});
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to sign in');
      if (err?.fields) setFields(err.fields);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to start or join your encrypted HD video conferences."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            component={RouterLink}
            to="/register"
            underline="hover"
            sx={{ fontWeight: 700, color: 'primary.main' }}
          >
            Create one for free
          </Link>
        </>
      }
    >
      {sessionExpired && (
        <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
          Your session expired. Please sign in again.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email address"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          error={Boolean(fields.email)}
          helperText={fields.email}
          onChange={(e) => setEmail(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MailOutlineIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
              </InputAdornment>
            ),
          }}
        />
        <PasswordField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Password"
          id="password"
          autoComplete="current-password"
          value={password}
          error={Boolean(fields.password)}
          helperText={fields.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Box sx={{ textAlign: 'right', mt: 1.2, mb: 1 }}>
          <Link
            component={RouterLink}
            to="/forgot-password"
            variant="body2"
            underline="hover"
            sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.825rem' }}
          >
            Forgot password?
          </Link>
        </Box>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          sx={{
            mt: 2,
            mb: 1.5,
            py: 1.3,
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LockOpenIcon />}
        >
          {loading ? 'Signing in…' : 'Sign in to VidCon'}
        </Button>
      </Box>
    </AuthCard>
  );
};

export default Login;
