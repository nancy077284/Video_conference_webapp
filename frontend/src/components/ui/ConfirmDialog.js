import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'error',
  loading = false,
  onConfirm,
  onCancel,
  children,
}) => (
  <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-dialog-title">
    <DialogTitle id="confirm-dialog-title" sx={{ pr: 6 }}>
      {title}
      <IconButton aria-label="Close dialog" onClick={onCancel} sx={{ position: 'absolute', right: 8, top: 8 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {children}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button
        variant="contained"
        color={severity}
        onClick={onConfirm}
        disabled={loading}
        autoFocus
      >
        {loading ? 'Working…' : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
