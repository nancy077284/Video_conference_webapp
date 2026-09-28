import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EventIcon from '@mui/icons-material/Event';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CallEndIcon from '@mui/icons-material/CallEnd';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockIcon from '@mui/icons-material/Lock';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CheckIcon from '@mui/icons-material/Check';

import UserAvatar from '../ui/UserAvatar';
import api from '../../services/api';
import { formatDateTime, formatDuration, formatRelative } from '../../utils/format';
import { useToast } from '../../context/ToastContext';

const statusColor = {
  scheduled: 'info',
  live: 'success',
  ended: 'default',
  cancelled: 'warning',
};

export const statusLabel = (status) =>
  ({ scheduled: 'Scheduled', live: 'Live Now', ended: 'Ended', cancelled: 'Cancelled' }[status] || status);

const MeetingCard = ({ meeting, onChange, compact = false }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [anchorEl, setAnchorEl] = useState(null);
  const [justCopied, setJustCopied] = useState(false);

  const host = meeting?.host || {};
  const isHost = meeting?.canManage;
  const isLive = meeting?.status === 'live';
  const isScheduled = meeting?.status === 'scheduled';
  const isEnded = meeting?.status === 'ended';

  const duration =
    meeting?.startedAt && meeting?.endedAt
      ? new Date(meeting.endedAt) - new Date(meeting.startedAt)
      : meeting?.durationMs || 0;

  const copyLink = async () => {
    const url = `${window.location.origin}/join/${meeting.meetingId}`;
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      toast.success('Meeting link copied to clipboard');
    } catch (err) {
      toast.info(`Meeting link: ${url}`);
    }
  };

  const isCancelled = meeting.status === 'cancelled';

  const deleteMeeting = async (permanent = false) => {
    setAnchorEl(null);
    const isPermanent = permanent || isEnded || isCancelled;
    const confirmMsg = isPermanent
      ? `Permanently delete "${meeting.title}" from meetings history?`
      : `Cancel "${meeting.title}"? Participants will be notified.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.deleteMeeting(meeting.meetingId, isPermanent);
      toast.success(res?.message || (isPermanent ? 'Meeting deleted from history' : 'Meeting cancelled'));
      onChange?.();
    } catch (err) {
      toast.error(err?.message || 'Could not delete the meeting');
    }
  };

  const endLiveMeeting = async () => {
    setAnchorEl(null);
    if (!window.confirm(`Terminate and end live meeting "${meeting.title}" for all participants?`)) return;

    try {
      const res = await api.endMeeting(meeting.meetingId);
      toast.success(res?.message || 'Meeting terminated for all participants');
      onChange?.();
    } catch (err) {
      toast.error(err?.message || 'Could not end the meeting');
    }
  };

  const joinable = isLive || isScheduled;

  return (
    <Paper
      variant="outlined"
      className="modern-card-interactive"
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: '18px',
        bgcolor: isDark ? 'rgba(14, 20, 36, 0.75)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid',
        borderColor: isLive
          ? alpha(theme.palette.success.main, 0.5)
          : isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(15, 23, 42, 0.08)',
        boxShadow: isLive ? `0 0 20px ${alpha(theme.palette.success.main, 0.18)}` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar with Title & Status */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
            {isLive ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    animation: 'livePulse 1.8s infinite',
                  }}
                />
                <Chip
                  size="small"
                  label="LIVE NOW"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    bgcolor: alpha(theme.palette.success.main, 0.16),
                    color: 'success.main',
                    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                  }}
                />
              </Box>
            ) : (
              <Chip
                size="small"
                label={statusLabel(meeting.status)}
                color={statusColor[meeting.status] || 'default'}
                variant={isDark ? 'filled' : 'outlined'}
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              />
            )}

            {meeting.waitingRoom && (
              <Tooltip title="Waiting Room Enabled">
                <Chip
                  size="small"
                  icon={<HourglassBottomIcon sx={{ fontSize: '13px !important' }} />}
                  label="Waiting"
                  sx={{ height: 22, fontSize: '0.68rem' }}
                />
              </Tooltip>
            )}
            {meeting.hasPassword && (
              <Tooltip title="Passcode Protected">
                <Chip
                  size="small"
                  icon={<LockIcon sx={{ fontSize: '13px !important' }} />}
                  label="Passcode"
                  sx={{ height: 22, fontSize: '0.68rem' }}
                />
              </Tooltip>
            )}
          </Stack>

          <Typography
            variant="subtitle1"
            fontWeight={750}
            noWrap
            sx={{
              cursor: 'pointer',
              fontSize: '1.05rem',
              letterSpacing: '-0.01em',
              transition: 'color 0.15s ease',
              '&:hover': { color: 'primary.main' },
            }}
            onClick={() => navigate(`/meetings/${meeting.meetingId}`)}
          >
            {meeting.title}
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label="Meeting actions"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            sx: {
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(20px)',
              minWidth: 180,
            },
          }}
        >
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              navigate(`/meetings/${meeting.meetingId}`);
            }}
          >
            <ListItemIcon>
              <InfoOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>
              View details
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              copyLink();
            }}
          >
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>
              Copy meeting link
            </ListItemText>
          </MenuItem>
          {isLive && isHost && (
            <MenuItem onClick={endLiveMeeting} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'error.main' }}>
                <CallEndIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }}>
                End live meeting
              </ListItemText>
            </MenuItem>
          )}
          {isHost && !isEnded && !isCancelled && !isLive && (
            <MenuItem onClick={() => deleteMeeting(false)} sx={{ color: 'warning.main' }}>
              <ListItemIcon sx={{ color: 'warning.main' }}>
                <CancelOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>
                Cancel meeting
              </ListItemText>
            </MenuItem>
          )}
          {(isHost || isEnded || isCancelled) && (
            <MenuItem onClick={() => deleteMeeting(true)} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'error.main' }}>
                <DeleteOutlineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>
                {isHost ? 'Delete meeting' : 'Remove from list'}
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
      </Stack>

      {/* Date & Time metadata */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ color: 'text.secondary', mt: 0.5 }}>
        <Stack direction="row" spacing={0.8} alignItems="center">
          <EventIcon sx={{ fontSize: 16, color: 'primary.main', opacity: 0.8 }} />
          <Typography variant="caption" sx={{ fontWeight: 550, fontSize: '0.8rem' }}>
            {meeting.scheduledAt ? formatDateTime(meeting.scheduledAt) : formatRelative(meeting.createdAt)}
          </Typography>
        </Stack>
        {duration > 0 && (
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              fontWeight: 600,
              fontSize: '0.72rem',
            }}
          >
            {formatDuration(duration)}
          </Typography>
        )}
      </Stack>

      {/* Host & Actions footer */}
      {!compact && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 'auto', pt: 1 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <UserAvatar name={host.name} avatar={host.avatar} size={28} />
            <Typography variant="caption" color="text.secondary" fontWeight={550} noWrap sx={{ maxWidth: 130 }}>
              {isHost ? 'You (Host)' : host.name || 'Host'}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={justCopied ? 'Link Copied!' : 'Copy Link'}>
              <IconButton
                size="small"
                onClick={copyLink}
                aria-label="Copy meeting link"
                sx={{
                  borderRadius: '9px',
                  border: '1px solid',
                  borderColor: justCopied ? 'success.main' : 'divider',
                  color: justCopied ? 'success.main' : 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                {justCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Quick End button for host when live */}
            {isLive && isHost && (
              <Tooltip title="Terminate live meeting for all">
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<CallEndIcon fontSize="small" />}
                  onClick={endLiveMeeting}
                  sx={{
                    borderRadius: '10px',
                    px: 1.3,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderColor: 'rgba(244, 63, 94, 0.4)',
                    '&:hover': {
                      borderColor: 'error.main',
                      bgcolor: 'rgba(244, 63, 94, 0.1)',
                    },
                  }}
                >
                  End
                </Button>
              </Tooltip>
            )}

            {/* Quick Delete button for past meetings */}
            {(isEnded || isCancelled) && (
              <Tooltip title={isHost ? 'Permanently delete from history' : 'Remove from list'}>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                  onClick={() => deleteMeeting(true)}
                  sx={{
                    borderRadius: '10px',
                    px: 1.3,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderColor: 'rgba(244, 63, 94, 0.35)',
                    '&:hover': {
                      borderColor: 'error.main',
                      bgcolor: 'rgba(244, 63, 94, 0.08)',
                    },
                  }}
                >
                  Delete
                </Button>
              </Tooltip>
            )}

            <Button
              size="small"
              variant={isLive ? 'contained' : 'outlined'}
              startIcon={<VideoCallIcon />}
              onClick={() => {
                if (isLive || isScheduled) navigate(`/join/${meeting.meetingId}`);
                else navigate(`/meetings/${meeting.meetingId}`);
              }}
              sx={{
                borderRadius: '10px',
                px: 1.8,
                fontSize: '0.8125rem',
                fontWeight: 700,
                ...(isLive && {
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  },
                }),
              }}
            >
              {isLive ? 'Join Now' : 'Details'}
            </Button>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
};

export default MeetingCard;
