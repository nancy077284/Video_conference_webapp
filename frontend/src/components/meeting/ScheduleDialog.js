import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const defaultForm = {
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  waitingRoom: true,
  passwordEnabled: false,
  password: '',
  invitees: '',
  allowChat: true,
  allowScreenShare: true,
};

const ScheduleDialog = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const update = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((err) => ({ ...err, [key]: undefined }));
  };

  const toIso = (date, time) => (date && time ? new Date(`${date}T${time}`).toISOString() : null);

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Give the meeting a title';
    if (!form.date) next.date = 'Pick a date';
    if (!form.startTime) next.startTime = 'Pick a start time';
    if (!form.endTime) next.endTime = 'Pick an end time';
    if (form.date && form.startTime && form.endTime) {
      const start = new Date(`${form.date}T${form.startTime}`);
      const end = new Date(`${form.date}T${form.endTime}`);
      if (end <= start) next.endTime = 'End time must be after start time';
      if (start.getTime() < Date.now() - 60000) next.date = 'Meeting cannot be in the past';
    }
    if (form.passwordEnabled && form.password.length < 4) next.password = 'At least 4 characters';
    const emails = form.invitees.split(/[\s,;]+/).filter(Boolean);
    const invalid = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
    if (invalid) next.invitees = `Invalid email: ${invalid}`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        scheduledAt: toIso(form.date, form.startTime),
        endsAt: toIso(form.date, form.endTime),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        waitingRoom: form.waitingRoom,
        password: form.passwordEnabled ? form.password : undefined,
        invitees: form.invitees.split(/[\s,;]+/).filter(Boolean),
        settings: { allowChat: form.allowChat, allowScreenShare: form.allowScreenShare },
      };
      const data = await api.scheduleMeeting(payload);
      toast.success('Meeting scheduled');
      setForm(defaultForm);
      onCreated?.(data.meeting);
      onClose?.();
    } catch (err) {
      if (err?.fields) setErrors(err.fields);
      toast.error(err?.message || 'Could not schedule the meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth scroll="body">
      <form onSubmit={submit} noValidate>
        <DialogTitle sx={{ pr: 6 }}>
          Schedule a meeting
          <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Meeting title"
              value={form.title}
              onChange={update('title')}
              error={Boolean(errors.title)}
              helperText={errors.title}
              required
              autoFocus
            />
            <TextField
              label="Description (optional)"
              value={form.description}
              onChange={update('description')}
              multiline
              minRows={2}
              inputProps={{ maxLength: 1000 }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Date"
                type="date"
                value={form.date}
                onChange={update('date')}
                error={Boolean(errors.date)}
                helperText={errors.date}
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Start time"
                type="time"
                value={form.startTime}
                onChange={update('startTime')}
                error={Boolean(errors.startTime)}
                helperText={errors.startTime}
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End time"
                type="time"
                value={form.endTime}
                onChange={update('endTime')}
                error={Boolean(errors.endTime)}
                helperText={errors.endTime}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Invite participants"
              placeholder="alice@example.com, bob@example.com"
              value={form.invitees}
              onChange={update('invitees')}
              error={Boolean(errors.invitees)}
              helperText={errors.invitees || 'Separate emails with commas. Invitees get a notification.'}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Security
              </Typography>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={<Switch checked={form.waitingRoom} onChange={update('waitingRoom')} />}
                  label="Use a waiting room"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.passwordEnabled}
                      onChange={(e) => setForm((f) => ({ ...f, passwordEnabled: e.target.checked }))}
                    />
                  }
                  label="Require a meeting password"
                />
                {form.passwordEnabled && (
                  <TextField
                    label="Meeting password"
                    value={form.password}
                    onChange={update('password')}
                    error={Boolean(errors.password)}
                    helperText={errors.password}
                    size="small"
                  />
                )}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Participant permissions
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Chip
                  label="Chat"
                  color={form.allowChat ? 'primary' : 'default'}
                  onClick={() => setForm((f) => ({ ...f, allowChat: !f.allowChat }))}
                  variant={form.allowChat ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Screen sharing"
                  color={form.allowScreenShare ? 'primary' : 'default'}
                  onClick={() => setForm((f) => ({ ...f, allowScreenShare: !f.allowScreenShare }))}
                  variant={form.allowScreenShare ? 'filled' : 'outlined'}
                />
              </Stack>
            </Box>
            {errors.invitees && <Alert severity="error">{errors.invitees}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" startIcon={<EventIcon />} disabled={loading}>
            {loading ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ScheduleDialog;
