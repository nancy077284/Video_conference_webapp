import React from 'react';
import { Box, Skeleton, Typography, Button, Paper, Stack } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InboxIcon from '@mui/icons-material/Inbox';

/** Skeleton loaders shared across pages. */
export const CardSkeleton = ({ height = 120, count = 1 }) => (
  <Stack spacing={2}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="rounded" height={height} sx={{ borderRadius: 3 }} />
    ))}
  </Stack>
);

export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <Stack spacing={1}>
    <Skeleton variant="rounded" height={44} />
    {Array.from({ length: rows }).map((_, r) => (
      <Skeleton key={r} variant="rounded" height={40} />
    ))}
    <Skeleton variant="text" width={120} />
    {cols === -1 ? null : null}
  </Stack>
);

export const PageSkeleton = () => (
  <Stack spacing={2}>
    <Skeleton variant="text" width={220} height={40} />
    <Skeleton variant="text" width={340} height={24} />
    <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 2 }}>
      <Skeleton variant="rounded" height={110} sx={{ borderRadius: 3 }} />
      <Skeleton variant="rounded" height={110} sx={{ borderRadius: 3 }} />
      <Skeleton variant="rounded" height={110} sx={{ borderRadius: 3 }} />
    </Box>
  </Stack>
);

/** Empty state block. */
export const EmptyState = ({ title = 'Nothing here yet', description, action, icon }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 5,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      bgcolor: 'background.subtle',
      borderStyle: 'dashed',
    }}
  >
    <Box sx={{ color: 'text.secondary', opacity: 0.7 }}>{icon || <InboxIcon sx={{ fontSize: 44 }} />}</Box>
    <Typography variant="h6">{title}</Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {description}
      </Typography>
    )}
    {action}
  </Paper>
);

/** Error state block with retry. */
export const ErrorState = ({ title = 'Something went wrong', description, onRetry }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 5,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      borderStyle: 'dashed',
    }}
  >
    <ErrorOutlineIcon color="error" sx={{ fontSize: 44 }} />
    <Typography variant="h6">{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
      {description || 'Please try again in a moment.'}
    </Typography>
    {onRetry && (
      <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
        Try again
      </Button>
    )}
  </Paper>
);

/**
 * Unified state renderer: loading -> empty -> error -> content.
 * Every major page uses this so no screen is ever blank.
 */
export const StateBlock = ({ loading, error, empty, onRetry, skeleton, emptyProps, errorProps, children }) => {
  if (loading) return skeleton || <PageSkeleton />;
  if (error)
    return (
      <ErrorState
        onRetry={onRetry}
        description={error?.message}
        {...errorProps}
      />
    );
  if (empty) return <EmptyState {...emptyProps} />;
  return children;
};

export default StateBlock;
