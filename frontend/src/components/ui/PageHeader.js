import React from 'react';
import { Box, Typography, Stack, Button } from '@mui/material';

const PageHeader = ({ title, subtitle, action, children }) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    alignItems={{ xs: 'flex-start', sm: 'center' }}
    justifyContent="space-between"
    spacing={2.5}
    sx={{ mb: 3.5 }}
  >
    <Box>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.65rem', sm: '2rem' },
          letterSpacing: '-0.025em',
          color: 'text.primary',
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, fontSize: '0.875rem', fontWeight: 500 }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
    {action && (
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {action}
      </Box>
    )}
    {children}
  </Stack>
);

export const QuickButton = ({ icon, label, onClick, variant = 'contained', ...rest }) => (
  <Button variant={variant} startIcon={icon} onClick={onClick} {...rest}>
    {label}
  </Button>
);

export default PageHeader;
