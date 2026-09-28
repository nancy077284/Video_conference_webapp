import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  Button,
  InputBase,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  List,
  ListItemButton,
  Paper,
  CircularProgress,
  Stack,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DashboardIcon from '@mui/icons-material/Dashboard';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import VideocamIcon from '@mui/icons-material/Videocam';
import BoltIcon from '@mui/icons-material/Bolt';

import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import UserAvatar from '../ui/UserAvatar';
import { tokens } from '../../theme';

export const Logo = ({ size = 36 }) => (
  <Box
    sx={{
      width: size,
      height: size,
      borderRadius: '11px',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.45)',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%)',
        borderRadius: 'inherit',
      },
    }}
    aria-hidden
  >
    <VideocamIcon sx={{ fontSize: size * 0.58, zIndex: 1 }} />
  </Box>
);

const navItems = (isAdmin) => [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Meetings', path: '/meetings', icon: <VideoCallIcon /> },
  { label: 'Notifications', path: '/notifications', icon: <NotificationsIcon /> },
  { label: 'Profile', path: '/profile', icon: <PersonOutlineIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon /> },
  ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: <AdminPanelSettingsIcon /> }] : []),
];

const GlobalSearch = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 350);
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  React.useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const controller = new AbortController();
    api
      .search(debounced.trim())
      .then((data) => {
        if (cancelled) return;
        setResults(data);
        setOpen(true);
      })
      .catch(() => {
        if (!cancelled) setResults({ error: true, meetings: [], users: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debounced]);

  const go = (path) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
    onNavigate?.();
  };

  return (
    <Box sx={{ position: 'relative', width: { xs: '100%', sm: 320, md: 380 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2,
          py: 0.85,
          borderRadius: 999,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.09)',
          transition: 'all 0.2s ease',
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 1)',
          },
        }}
      >
        <SearchIcon sx={{ fontSize: 19, color: 'text.secondary', opacity: 0.8 }} />
        <InputBase
          fullWidth
          placeholder="Search meetings, IDs, people…"
          inputProps={{ 'aria-label': 'Search meetings and people' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          sx={{ fontSize: 13.5, fontWeight: 500 }}
        />
        {loading ? (
          <CircularProgress size={16} thickness={5} />
        ) : (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              px: 0.9,
              py: 0.2,
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: '1px solid',
              borderColor: 'divider',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            ⌘K
          </Box>
        )}
      </Box>
      {open && results && (
        <Paper
          elevation={12}
          sx={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: 380,
            overflow: 'auto',
            p: 1,
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(24px)',
            bgcolor: isDark ? 'rgba(14, 20, 36, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
          }}
        >
          {results.error ? (
            <Typography variant="body2" color="error" sx={{ p: 1.5 }}>
              Search failed. Please try again.
            </Typography>
          ) : (
            <>
              {(results.meetings || []).length === 0 && (results.users || []).length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No matches found for “{query}”
                </Typography>
              )}
              {(results.meetings || []).map((m) => (
                <ListItemButton
                  key={m.meetingId}
                  onMouseDown={() => go(`/meetings/${m.meetingId}`)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <VideoCallIcon sx={{ fontSize: 18 }} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={m.title}
                    secondary={`${m.meetingId} • ${m.status}`}
                    primaryTypographyProps={{ noWrap: true, fontSize: 13.5, fontWeight: 600 }}
                    secondaryTypographyProps={{ noWrap: true, fontSize: 11.5 }}
                  />
                </ListItemButton>
              ))}
              {(results.users || []).map((u) => (
                <ListItemButton
                  key={u._id}
                  onMouseDown={() => go('/admin/users')}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <UserAvatar name={u.name} size={28} />
                  </ListItemIcon>
                  <ListItemText
                    primary={u.name}
                    secondary={u.email}
                    primaryTypographyProps={{ noWrap: true, fontSize: 13.5, fontWeight: 600 }}
                    secondaryTypographyProps={{ noWrap: true, fontSize: 11.5 }}
                  />
                </ListItemButton>
              ))}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

const AppShell = ({ children }) => {
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = mode === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [unread, setUnread] = useState(0);

  const items = useMemo(() => navItems(isAdmin), [isAdmin]);

  React.useEffect(() => {
    let active = true;
    const load = () =>
      api
        .unreadCount()
        .then((d) => active && setUnread(d.unreadCount || 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    const onFocus = () => {
      api.unreadCount().then((d) => setUnread(d.unreadCount || 0)).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    toast.info('Signed out successfully');
    navigate('/login');
  };

  const sidebar = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2.2 }}>
      {/* Brand Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          px: 1,
          py: 1.2,
          mb: 2.5,
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <Logo size={38} />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.8}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              VidCon
            </Typography>
            <Chip
              label="PRO"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 800,
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                color: 'primary.main',
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.25),
              }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block', mt: -0.2 }}>
            Next-Gen HD Meetings
          </Typography>
        </Box>
      </Stack>

      {/* Nav links */}
      <List sx={{ flex: 1, p: 0 }}>
        {items.map((item) => {
          const selected =
            location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(`${item.path}/`));
          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.75,
                px: 1.75,
                py: 1.1,
                borderRadius: '12px',
                color: selected ? (isDark ? '#ffffff' : '#0f172a') : 'text.secondary',
                fontWeight: selected ? 700 : 550,
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                bgcolor: selected
                  ? isDark
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'rgba(99, 102, 241, 0.08)'
                  : 'transparent',
                border: selected
                  ? `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.35 : 0.25)}`
                  : '1px solid transparent',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                  color: isDark ? '#ffffff' : '#0f172a',
                  transform: 'translateX(3px)',
                },
                '&.Mui-selected': {
                  bgcolor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.1)',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.15)',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: selected ? 'primary.main' : 'inherit',
                  transition: 'color 0.2s',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: selected ? 700 : 550,
                  letterSpacing: '-0.01em',
                }}
              />
              {selected && (
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    boxShadow: '0 0 8px #6366f1',
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      {/* Pro Quick Tip Card */}
      <Box
        sx={{
          p: 1.8,
          mb: 2,
          borderRadius: '14px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.07) 0%, rgba(168, 85, 247, 0.04) 100%)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.15)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <BoltIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Instant Connect
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.74rem', lineHeight: 1.45 }}>
          Start an encrypted video meeting with one click.
        </Typography>
      </Box>

      <Divider sx={{ my: 1, borderColor: 'divider' }} />

      {/* Bottom Profile card */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.2,
          borderRadius: '12px',
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
            borderColor: alpha(theme.palette.primary.main, 0.3),
          },
        }}
        onClick={() => navigate('/profile')}
      >
        <Box sx={{ position: 'relative' }}>
          <UserAvatar name={user?.name} avatar={user?.avatar} size={38} />
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: '#10b981',
              border: `2px solid ${isDark ? '#0e1424' : '#ffffff'}`,
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" noWrap fontWeight={700} sx={{ fontSize: 13.5 }}>
            {user?.name || 'User'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: 11.5 }}>
            {user?.email}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{ width: { md: tokens.sidebarWidth }, flexShrink: 0, display: { xs: 'none', md: 'block' } }}
        aria-label="Main navigation"
      >
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            right: 'auto',
            width: tokens.sidebarWidth,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: isDark ? 'rgba(10, 14, 26, 0.82)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(24px)',
            zIndex: 10,
          }}
        >
          {sidebar}
        </Box>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            bgcolor: isDark ? '#0b101d' : '#ffffff',
            backgroundImage: 'none',
          },
        }}
      >
        {sidebar}
      </Drawer>

      {/* Main Column */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          sx={{
            bgcolor: isDark ? 'rgba(7, 10, 19, 0.72)' : 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: 5,
          }}
        >
          <Toolbar
            sx={{
              gap: 1.5,
              minHeight: { xs: 58, md: tokens.topbarHeight },
              px: { xs: 2, md: 3.5 },
            }}
          >
            <IconButton
              edge="start"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' }, borderRadius: 2 }}
            >
              <MenuIcon />
            </IconButton>

            {/* Global Search */}
            <Box sx={{ display: { xs: 'none', sm: 'block' }, flex: 1 }}>
              <GlobalSearch />
            </Box>
            <Box sx={{ flex: 1, display: { xs: 'block', sm: 'none' } }} />

            {/* Theme Toggle */}
            <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton
                onClick={toggleMode}
                aria-label="Toggle color theme"
                sx={{
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    transform: 'rotate(15deg)',
                  },
                }}
              >
                {isDark ? (
                  <LightModeOutlinedIcon sx={{ fontSize: 20, color: '#fbbf24' }} />
                ) : (
                  <DarkModeOutlinedIcon sx={{ fontSize: 20, color: '#6366f1' }} />
                )}
              </IconButton>
            </Tooltip>

            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton
                aria-label={`Notifications, ${unread} unread`}
                onClick={() => navigate('/notifications')}
                sx={{
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  },
                }}
              >
                <Badge
                  badgeContent={unread}
                  color="error"
                  max={9}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.65rem',
                      height: 17,
                      minWidth: 17,
                      fontWeight: 800,
                    },
                  }}
                >
                  {unread > 0 ? (
                    <NotificationsIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  ) : (
                    <NotificationsNoneIcon sx={{ fontSize: 20 }} />
                  )}
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Quick New Meeting Action */}
            <Button
              variant="contained"
              startIcon={<VideoCallIcon />}
              onClick={() => navigate('/join')}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                borderRadius: '11px',
                px: 2.2,
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              New Meeting
            </Button>

            {/* User Profile Avatar Menu */}
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="Account menu"
              size="small"
              sx={{
                p: 0.3,
                border: '2px solid',
                borderColor: alpha(theme.palette.primary.main, 0.4),
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.5)}`,
                },
              }}
            >
              <UserAvatar name={user?.name} avatar={user?.avatar} size={34} />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  borderRadius: '16px',
                  mt: 1.5,
                  minWidth: 230,
                  p: 0.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" fontWeight={750} noWrap>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {user?.email}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/profile');
                }}
                sx={{ borderRadius: 1.5, py: 1 }}
              >
                <ListItemIcon>
                  <PersonOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>Profile</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/settings');
                }}
                sx={{ borderRadius: 1.5, py: 1 }}
              >
                <ListItemIcon>
                  <SettingsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>Settings</ListItemText>
              </MenuItem>
              {isAdmin && (
                <MenuItem
                  onClick={() => {
                    setAnchorEl(null);
                    navigate('/admin');
                  }}
                  sx={{ borderRadius: 1.5, py: 1 }}
                >
                  <ListItemIcon>
                    <AdminPanelSettingsIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600, color: 'primary.main' }}>
                    Admin Console
                  </ListItemText>
                </MenuItem>
              )}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout} sx={{ borderRadius: 1.5, py: 1, color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'error.main' }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}>Sign Out</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Content Area */}
        <Box
          component="main"
          sx={{
            p: { xs: 2.2, sm: 3, md: 4 },
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
            flex: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppShell;
