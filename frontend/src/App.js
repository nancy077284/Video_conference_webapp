import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider as AppThemeProvider, useThemeMode } from './context/ThemeContext';
import { PrivateRoute, AdminRoute, PublicRoute, Unauthorized, FullScreenLoader } from './components/guards';
import AppShell from './components/layout/AppShell';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Meetings = lazy(() => import('./pages/Meetings'));
const Room = lazy(() => import('./pages/Room'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Fallbacks for optional sub-pages
const MeetingDetail = () => <Meetings />;
const PreJoin = () => <Navigate to="/dashboard" replace />;
const Profile = () => <Dashboard />;
const Settings = () => <Dashboard />;
const Notifications = () => <Meetings />;
const AdminOverview = () => <Dashboard />;
const AdminUsers = () => <Dashboard />;
const AdminMeetings = () => <Dashboard />;
const AdminAnalytics = () => <Dashboard />;
const AdminAudit = () => <Dashboard />;
const AdminLayout = () => <Dashboard />;

const Loading = () => (
  <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <CircularProgress />
  </Box>
);

const Shell = ({ children }) => <AppShell>{children}</AppShell>;

const ThemedRoutes = () => {
  const { theme } = useThemeMode();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Shell>
                  <Dashboard />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/meetings"
            element={
              <PrivateRoute>
                <Shell>
                  <Meetings />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/meetings/:meetingId"
            element={
              <PrivateRoute>
                <Shell>
                  <MeetingDetail />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <PrivateRoute>
                <Shell>
                  <Notifications />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Shell>
                  <Profile />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Shell>
                  <Settings />
                </Shell>
              </PrivateRoute>
            }
          />

          <Route
            path="/join"
            element={
              <PrivateRoute>
                <Suspense fallback={<Loading />}>
                  <PreJoin mode="instant" />
                </Suspense>
              </PrivateRoute>
            }
          />
          <Route
            path="/join/:meetingId"
            element={
              <PrivateRoute>
                <Suspense fallback={<Loading />}>
                  <Room />
                </Suspense>
              </PrivateRoute>
            }
          />
          <Route
            path="/room/:meetingId"
            element={
              <PrivateRoute>
                <Suspense fallback={<Loading />}>
                  <Room />
                </Suspense>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Suspense fallback={<Loading />}>
                  <AdminLayout />
                </Suspense>
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="meetings" element={<AdminMeetings />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/"
            element={<PrivateRoute><Navigate to="/dashboard" replace /></PrivateRoute>}
          />
          <Route
            path="*"
            element={
              <Suspense fallback={<Loading />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

function App() {
  return (
    <AppThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ThemedRoutes />
        </AuthProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}

export default App;
