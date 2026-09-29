import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Typography,
  Stack,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Paper,
  InputAdornment,
  useTheme,
  alpha,
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HistoryIcon from '@mui/icons-material/History';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LinkIcon from '@mui/icons-material/Link';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { useAsync } from '../hooks/useAsync';
import StatCard from '../components/ui/StatCard';
import MeetingCard from '../components/meeting/MeetingCard';
import ScheduleDialog from '../components/meeting/ScheduleDialog';
import { StateBlock, CardSkeleton, EmptyState } from '../components/ui/StateBlock';
import { formatDuration } from '../utils/format';

const Dashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [joinError, setJoinError] = useState('');

  const dashboard = useAsync(() => api.getDashboard(), []);
  const stats = useAsync(() => api.getStats(), []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const startInstant = useCallback(async () => {
    try {
      const data = await api.createMeeting('Instant Meeting');
      toast.success('Meeting room created!');
      navigate(`/room/${data.meeting.meetingId}`);
    } catch (err) {
      toast.error(err?.message || 'Could not start the meeting');
    }
  }, [navigate, toast]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');
    const code = joinId.trim();
    if (!code) {
      setJoinError('Enter a meeting ID or link');
      return;
    }
    const match = code.match(/([a-zA-Z0-9-]{4,32})\s*$/);
    const normalized = match ? match[1] : code;
    try {
      await api.joinMeeting(normalized).catch(() => {});
      setJoinOpen(false);
      navigate(`/room/${normalized}`);
    } catch (err) {
      setJoinError(err?.message || 'Meeting not found');
    }
  };

  const data = dashboard.data;
  const s = stats.data?.stats;
  const hasMeetings =
    data && (data.upcoming.length > 0 || data.today.length > 0 || data.recent.length > 0 || data.live.length > 0);

  return (
    <Box>
      {/* Hero Welcome & Quick Launch Banner */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3.5,
          borderRadius: '24px',
          position: 'relative',
          overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(168, 85, 247, 0.10) 50%, rgba(14, 20, 36, 0.8) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.09) 0%, rgba(168, 85, 247, 0.06) 50%, rgba(255, 255, 255, 0.9) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.16)',
          boxShadow: isDark
            ? '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
            : '0 20px 40px -15px rgba(99, 102, 241, 0.12)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={3}
        >
          <Box sx={{ maxWidth: 540 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip
                icon={<FlashOnIcon sx={{ fontSize: '14px !important', color: '#6366f1' }} />}
                label="VidCon Workspace"
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: 750,
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.25),
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Typography>
            </Stack>

            <Typography
              variant="h3"
              sx={{
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                mb: 1,
              }}
            >
              {getGreeting()},{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {user?.name?.split(' ')[0] || 'there'} 👋
              </Box>
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.55 }}>
              Ready for collaboration? Start an instant room, schedule an upcoming call, or join with a code.
            </Typography>
          </Box>

          {/* Quick Actions Trio */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<VideoCallIcon />}
              onClick={startInstant}
              sx={{
                borderRadius: '13px',
                px: 2.8,
                py: 1.3,
                fontSize: '0.93rem',
                fontWeight: 750,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.45)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
                  boxShadow: '0 8px 26px rgba(99, 102, 241, 0.55)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Start Instant Meeting
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<CalendarMonthIcon />}
              onClick={() => setScheduleOpen(true)}
              sx={{
                borderRadius: '13px',
                px: 2.2,
                py: 1.3,
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              Schedule
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<GroupAddIcon />}
              onClick={() => setJoinOpen(true)}
              sx={{
                borderRadius: '13px',
                px: 2.2,
                py: 1.3,
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              Join with ID
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stat Cards Grid */}
      <Box
        sx={{
          display: 'grid',
          gap: 2.2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          mb: 4,
        }}
      >
        <StatCard
          label="Total Meetings"
          value={stats.loading ? '—' : s?.totalMeetings ?? 0}
          icon={<VideoCallIcon />}
          accent="#6366f1"
          hint={stats.error ? 'Stats unavailable' : 'Hosted + Attended'}
        />
        <StatCard
          label="Hosted by You"
          value={stats.loading ? '—' : s?.meetingsHosted ?? 0}
          icon={<EventAvailableIcon />}
          accent="#10b981"
          hint="Owned meetings"
        />
        <StatCard
          label="Upcoming Calls"
          value={stats.loading ? '—' : s?.upcoming ?? 0}
          icon={<ScheduleIcon />}
          accent="#f59e0b"
          hint="Scheduled on calendar"
        />
        <StatCard
          label="Total Duration"
          value={stats.loading ? '—' : formatDuration(s?.totalDurationMs || 0)}
          icon={<HistoryIcon />}
          accent="#a855f7"
          hint="Time spent collaborating"
        />
      </Box>

      {/* Meetings Section */}
      <StateBlock
        loading={dashboard.loading}
        error={dashboard.error}
        onRetry={dashboard.reload}
        skeleton={<CardSkeleton height={150} count={3} />}
        empty={!hasMeetings}
        emptyProps={{
          title: 'No meetings scheduled yet',
          description: 'Start an instant room right now or schedule a conference for your team.',
          action: (
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              <Button variant="contained" startIcon={<VideoCallIcon />} onClick={startInstant}>
                Start Instant Meeting
              </Button>
              <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={() => setScheduleOpen(true)}>
                Schedule Meeting
              </Button>
            </Stack>
          ),
        }}
      >
        <Stack spacing={4}>
          {/* Live Now in Progress */}
          {data?.live?.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    animation: 'livePulse 1.8s infinite',
                  }}
                />
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: '"Outfit", sans-serif',
                    fontWeight: 750,
                    fontSize: '1.25rem',
                  }}
                >
                  Live in Progress
                </Typography>
                <Chip
                  label={`${data.live.length} ACTIVE`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    bgcolor: alpha(theme.palette.success.main, 0.15),
                    color: 'success.main',
                  }}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2.2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' },
                }}
              >
                {data.live.map((m) => (
                  <MeetingCard key={m.meetingId} meeting={m} onChange={dashboard.reload} />
                ))}
              </Box>
            </Box>
          )}

          {/* Today's Meetings */}
          {data?.today?.length > 0 && (
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 750,
                  fontSize: '1.25rem',
                  mb: 2,
                }}
              >
                Today&apos;s Schedule
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2.2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' },
                }}
              >
                {data.today.map((m) => (
                  <MeetingCard key={m.meetingId} meeting={m} onChange={dashboard.reload} />
                ))}
              </Box>
            </Box>
          )}

          {/* Upcoming Meetings */}
          {data?.upcoming?.length > 0 && (
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 750,
                  fontSize: '1.25rem',
                  mb: 2,
                }}
              >
                Upcoming Meetings
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2.2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' },
                }}
              >
                {data.upcoming.slice(0, 6).map((m) => (
                  <MeetingCard key={m.meetingId} meeting={m} onChange={dashboard.reload} />
                ))}
              </Box>
            </Box>
          )}

          {/* Recent Activity */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 750,
                  fontSize: '1.25rem',
                }}
              >
                Recent Activity
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/meetings')}
                sx={{ fontWeight: 650, borderRadius: 1.5 }}
              >
                View all
              </Button>
            </Stack>

            {data?.recent?.length ? (
              <Stack spacing={1.5}>
                {data.recent.slice(0, 6).map((m) => (
                  <MeetingCard key={m.meetingId} meeting={m} compact onChange={dashboard.reload} />
                ))}
              </Stack>
            ) : (
              <EmptyState title="No past meetings" description="Meetings you attend will appear in this log." />
            )}
          </Box>
        </Stack>
      </StateBlock>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={(meeting) => navigate(`/meetings/${meeting.meetingId}`)}
      />

      {/* Join with ID Dialog */}
      <Dialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 1,
          },
        }}
      >
        <form onSubmit={handleJoin}>
          <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, fontSize: '1.35rem' }}>
            Join a Meeting
          </DialogTitle>
          <DialogContent>
            {joinError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {joinError}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the meeting ID or paste the invite link to join immediately.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Meeting ID or Link"
              placeholder="e.g. 4f2a9c81b0"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              error={Boolean(joinError)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button onClick={() => setJoinOpen(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<VideoCallIcon />}
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              Join Meeting
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
