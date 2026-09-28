import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, Paper, Stack } from '@mui/material';
import ExploreOffIcon from '@mui/icons-material/ExploreOff';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
        <ExploreOffIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
        <Typography variant="h3" sx={{ mt: 2 }}>
          404
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The page you are looking for may have been moved or the link is outdated.
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button variant="contained" onClick={() => navigate('/dashboard')}>
            Open dashboard
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default NotFound;
