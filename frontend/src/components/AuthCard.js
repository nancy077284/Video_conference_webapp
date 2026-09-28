import React from 'react';
import { Container, Box, Typography, Paper, Stack, Chip, useTheme, alpha } from '@mui/material';
import { Logo } from './layout/AppShell';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import GroupsIcon from '@mui/icons-material/Groups';

/**
 * Modern futuristic auth card with luminous ambient gradients and glassmorphism.
 */
const AuthCard = ({ title, subtitle, children, footer }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.default',
        px: 2,
        py: { xs: 4, sm: 6 },
      }}
    >
      {/* Ambient background glow orbs */}
      <Box
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(99, 102, 241, 0) 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'floatOrb 14s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-15%',
          right: '10%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(236, 72, 153, 0) 70%)'
            : 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0) 70%)',
          filter: 'blur(70px)',
          animation: 'floatOrb 18s ease-in-out infinite reverse',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Top Brand Banner */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3.5 }}>
          <Box sx={{ p: 0.5, borderRadius: '16px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <Logo size={48} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '1.75rem', sm: '2.1rem' },
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            VidCon
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              sx={{ maxWidth: 380, fontSize: '0.9rem' }}
            >
              {subtitle}
            </Typography>
          )}

          {/* Feature Badges */}
          <Stack direction="row" spacing={1} sx={{ pt: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip
              icon={<SecurityIcon style={{ fontSize: 14 }} />}
              label="E2E Encrypted"
              size="small"
              sx={{
                height: 24,
                fontSize: '0.7rem',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Chip
              icon={<SpeedIcon style={{ fontSize: 14 }} />}
              label="Low Latency"
              size="small"
              sx={{
                height: 24,
                fontSize: '0.7rem',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Chip
              icon={<GroupsIcon style={{ fontSize: 14 }} />}
              label="HD Grid"
              size="small"
              sx={{
                height: 24,
                fontSize: '0.7rem',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Stack>
        </Stack>

        {/* Auth Glass Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4.5 },
            borderRadius: '24px',
            bgcolor: isDark ? 'rgba(14, 20, 36, 0.78)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
            boxShadow: isDark
              ? '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 25px 60px -15px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)',
          }}
        >
          {title && (
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 750,
                letterSpacing: '-0.015em',
                mb: 2.5,
              }}
            >
              {title}
            </Typography>
          )}
          {children}
        </Paper>

        {/* Footer */}
        {footer && (
          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            sx={{ mt: 3, fontSize: '0.875rem' }}
          >
            {footer}
          </Typography>
        )}
      </Container>
    </Box>
  );
};

export default AuthCard;
