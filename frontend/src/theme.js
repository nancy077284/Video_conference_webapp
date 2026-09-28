import { createTheme, alpha } from '@mui/material';

export const tokens = {
  radius: { sm: 8, md: 12, lg: 18, xl: 24 },
  sidebarWidth: 260,
  topbarHeight: 68,
};

const fontFamily = [
  '"Plus Jakarta Sans"',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  'sans-serif',
].join(',');

const displayFont = [
  '"Outfit"',
  '"Plus Jakarta Sans"',
  '-apple-system',
  'sans-serif',
].join(',');

const build = (mode) => {
  const isDark = mode === 'dark';

  const primaryMain = isDark ? '#6366f1' : '#4f46e5';
  const primaryLight = isDark ? '#818cf8' : '#6366f1';
  const primaryDark = isDark ? '#4f46e5' : '#3730a3';

  const secondaryMain = isDark ? '#a855f7' : '#9333ea';

  const bgDefault = isDark ? '#070a13' : '#f8fafc';
  const bgPaper = isDark ? '#0e1424' : '#ffffff';
  const bgSubtle = isDark ? '#141d33' : '#f1f5f9';

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  const divider = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        light: primaryLight,
        dark: primaryDark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: secondaryMain,
        light: '#c084fc',
        dark: '#7e22ce',
        contrastText: '#ffffff',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#f43f5e',
        light: '#fb7185',
        dark: '#e11d48',
      },
      info: {
        main: '#06b6d4',
        light: '#22d3ee',
        dark: '#0891b2',
      },
      background: {
        default: bgDefault,
        paper: bgPaper,
        subtle: bgSubtle,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
      divider,
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
        selected: isDark ? alpha(primaryMain, 0.16) : alpha(primaryMain, 0.1),
      },
    },
    typography: {
      fontFamily,
      h1: { fontFamily: displayFont, fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontFamily: displayFont, fontWeight: 800, letterSpacing: '-0.025em' },
      h3: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.015em' },
      h5: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 650, letterSpacing: '-0.005em' },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600, letterSpacing: '0.005em' },
      button: { textTransform: 'none', fontWeight: 650, letterSpacing: 0 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.84375rem', lineHeight: 1.55 },
      caption: { fontSize: '0.75rem', letterSpacing: '0.01em' },
    },
    shape: {
      borderRadius: tokens.radius.md,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: bgDefault,
            color: textPrimary,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 11,
            padding: '9px 18px',
            minHeight: 42,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            fontWeight: 650,
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          containedPrimary: {
            background: isDark
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: `0 4px 16px -2px ${alpha(primaryMain, 0.45)}`,
            '&:hover': {
              background: isDark
                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                : 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)',
              boxShadow: `0 8px 24px -3px ${alpha(primaryMain, 0.55)}`,
            },
          },
          outlined: {
            borderWidth: '1.5px',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.14)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              borderWidth: '1.5px',
              borderColor: primaryMain,
              backgroundColor: alpha(primaryMain, isDark ? 0.08 : 0.04),
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: tokens.radius.lg,
            borderColor: divider,
          },
          outlined: {
            border: `1px solid ${divider}`,
            backgroundColor: isDark ? 'rgba(14, 20, 36, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(16px)',
          },
        },
      },
      MuiCard: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.lg,
            border: `1px solid ${divider}`,
            backgroundColor: isDark ? 'rgba(14, 20, 36, 0.75)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
          color: 'transparent',
        },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(7, 10, 19, 0.75)' : 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${divider}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? 'rgba(10, 14, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRight: `1px solid ${divider}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 11,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
            transition: 'all 0.2s ease',
            '& fieldset': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',
              borderWidth: '1px',
            },
            '&:hover fieldset': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.25)',
            },
            '&.Mui-focused fieldset': {
              borderColor: primaryMain,
              borderWidth: '1.5px',
              boxShadow: `0 0 0 4px ${alpha(primaryMain, isDark ? 0.22 : 0.14)}`,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 650,
            borderRadius: 999,
          },
          filled: {
            backdropFilter: 'blur(8px)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.xl,
            backgroundColor: isDark ? 'rgba(14, 20, 36, 0.92)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${divider}`,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)'
              : '0 25px 50px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.05)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.18s ease',
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#0f172a',
            color: '#ffffff',
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '6px 10px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          },
          arrow: {
            color: isDark ? '#1e293b' : '#0f172a',
          },
        },
      },
    },
  });
};

export const getTheme = (mode) => build(mode === 'dark' ? 'dark' : 'light');
