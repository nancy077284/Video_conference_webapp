import React from 'react';
import { Paper, Typography, Stack, Box, useTheme, alpha } from '@mui/material';

const StatCard = ({ label, value, icon, hint, accent = '#6366f1' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      variant="outlined"
      className="modern-card-interactive"
      sx={{
        p: 2.5,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '18px',
        bgcolor: isDark ? 'rgba(14, 20, 36, 0.75)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${accent}, transparent)`,
          opacity: 0.8,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'text.secondary',
              display: 'block',
              mb: 0.75,
              fontSize: '0.72rem',
            }}
          >
            {label}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '1.75rem', sm: '2.1rem' },
              lineHeight: 1.1,
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </Typography>
        </Box>

        {icon && (
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
              background: isDark
                ? `radial-gradient(circle, ${alpha(accent, 0.22)} 0%, ${alpha(accent, 0.08)} 100%)`
                : `radial-gradient(circle, ${alpha(accent, 0.15)} 0%, ${alpha(accent, 0.05)} 100%)`,
              border: `1px solid ${alpha(accent, isDark ? 0.3 : 0.2)}`,
              boxShadow: `0 4px 12px ${alpha(accent, 0.15)}`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>

      {hint && (
        <Typography
          variant="caption"
          sx={{
            mt: 1.5,
            color: 'text.secondary',
            display: 'block',
            fontWeight: 500,
            fontSize: '0.75rem',
          }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
};

export default StatCard;
