import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Button,
  Pagination,
  Stack,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import api from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';
import MeetingCard from '../components/meeting/MeetingCard';
import ScheduleDialog from '../components/meeting/ScheduleDialog';
import { StateBlock, CardSkeleton } from '../components/ui/StateBlock';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past Meetings' },
  { key: 'hosted', label: 'Hosted by Me' },
  { key: 'joined', label: 'Joined' },
];

const emptyCopy = {
  upcoming: {
    title: 'No upcoming meetings',
    description: 'Schedule a conference to collaborate with your team, classmates, or clients.',
  },
  past: {
    title: 'No past meetings recorded',
    description: 'Conferences you attended or hosted will appear here once they conclude.',
  },
  hosted: {
    title: 'You haven’t hosted any meetings yet',
    description: 'Start an instant room or schedule a future meeting to become a host.',
  },
  joined: {
    title: 'No joined meetings yet',
    description: 'Any meeting you enter with an invitation code will be logged here.',
  },
};

const Meetings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const tab = searchParams.get('tab') || 'upcoming';
  const page = Number(searchParams.get('page') || 1);
  const [search, setSearch] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const debounced = useDebounce(search, 350);

  useEffect(() => {
    setSearchParams({ tab, page: '1' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = useAsync(
    () => api.listMeetings({ tab, page, search: debounced, limit: 9 }),
    [tab, page, debounced]
  );

  const items = query.data?.items || [];

  const toast = useToast();

  const handleClearPastMeetings = async () => {
    if (!window.confirm('Are you sure you want to clear all past meetings from your history?')) return;
    try {
      const res = await api.clearMeetingHistory();
      toast.success(res?.message || 'Past meetings cleared');
      query.reload();
    } catch (err) {
      toast.error(err?.message || 'Could not clear past meetings');
    }
  };

  const startInstant = async () => {
    try {
      const data = await api.createMeeting('Instant Meeting');
      navigate(`/room/${data.meeting.meetingId}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Meetings Hub"
        subtitle="Manage upcoming calls, past recordings, and active conferences."
        action={
          <>
            {tab === 'past' && items.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={handleClearPastMeetings}
                sx={{ borderRadius: '11px', px: 2.2 }}
              >
                Clear Past
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => setScheduleOpen(true)}
              sx={{ borderRadius: '11px', px: 2.2 }}
            >
              Schedule
            </Button>
            <Button
              variant="contained"
              startIcon={<VideoCallIcon />}
              onClick={startInstant}
              sx={{ borderRadius: '11px', px: 2.5 }}
            >
              Start Meeting
            </Button>
          </>
        }
      />

      {/* Tabs & Search Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{
          mb: 3,
          p: 0.8,
          borderRadius: '16px',
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, value) => setSearchParams({ tab: value, page: '1' })}
          aria-label="Meeting filters"
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              height: '100%',
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
              zIndex: 0,
            },
            '& .MuiTab-root': {
              minHeight: 44,
              px: 2.2,
              borderRadius: '10px',
              fontWeight: 650,
              fontSize: '0.85rem',
              zIndex: 1,
              color: 'text.secondary',
              transition: 'color 0.2s',
              '&.Mui-selected': {
                color: isDark ? '#ffffff' : 'primary.main',
              },
            },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>

        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or ID…"
          inputProps={{ 'aria-label': 'Search meetings' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: '100%', sm: 260 } }}
        />
      </Stack>

      <StateBlock
        loading={query.loading}
        error={query.error}
        onRetry={query.reload}
        skeleton={<CardSkeleton height={160} count={3} />}
        empty={!query.loading && !query.error && items.length === 0}
        emptyProps={emptyCopy[tab] || emptyCopy.upcoming}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' },
          }}
        >
          {items.map((m) => (
            <MeetingCard key={m.meetingId} meeting={m} onChange={query.reload} />
          ))}
        </Box>

        {query.data?.pages > 1 && (
          <Stack alignItems="center" sx={{ mt: 4 }}>
            <Pagination
              count={query.data.pages}
              page={page}
              onChange={(_, value) => {
                setSearchParams({ tab, page: String(value) });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              color="primary"
              shape="rounded"
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: '10px',
                  fontWeight: 700,
                },
              }}
            />
          </Stack>
        )}

        {items.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
            Showing {items.length} of {query.data?.total} total meetings
          </Typography>
        )}
      </StateBlock>

      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={(meeting) => navigate(`/meetings/${meeting.meetingId}`)}
      />
    </Box>
  );
};

export default Meetings;
