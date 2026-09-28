import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  AppBar,
  Toolbar,
  Tooltip,
  Chip,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SendIcon from '@mui/icons-material/Send';
import PanToolIcon from '@mui/icons-material/PanTool';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const Room = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [meetingTime, setMeetingTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [remoteHandRaised, setRemoteHandRaised] = useState({});
  const [meetingData, setMeetingData] = useState(null);

  const toast = useToast();

  useEffect(() => {
    api.getMeeting(meetingId)
      .then((res) => {
        if (res?.meeting) setMeetingData(res.meeting);
      })
      .catch((err) => {
        console.warn('Could not load meeting info:', err);
      });
  }, [meetingId]);

  const isHost = Boolean(
    meetingData?.canManage ||
    (meetingData?.host && user && String(meetingData.host?._id || meetingData.host) === String(user?._id || user?.id))
  );

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateRemoteVideo = (socketId, stream) => {
    const el = document.getElementById(`remote-${socketId}`);
    if (el) el.srcObject = stream;
  };

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave-room', { roomId: meetingId });
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate('/dashboard');
  }, [meetingId, navigate]);

  const endMeetingForAll = useCallback(async () => {
    if (!window.confirm('Are you sure you want to terminate and end this meeting for everyone? All participants will be disconnected.')) {
      return;
    }
    try {
      await api.endMeeting(meetingId);
      socketRef.current?.emit('end-room', { roomId: meetingId });
      toast.success('Meeting terminated for all participants');
    } catch (err) {
      console.error('Failed to end meeting via API:', err);
    } finally {
      leaveRoom();
    }
  }, [meetingId, leaveRoom, toast]);

  useEffect(() => {
    const peerConnections = peerConnectionsRef.current;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socketServer = window.location.port === '3000'
          ? 'http://localhost:5001'
          : window.location.origin;
        socketRef.current = io(socketServer);
        const sock = socketRef.current;

        sock.emit('join-room', {
          roomId: meetingId,
          userId: user.id,
          userName: user.name,
        });

        sock.on('room:ended', ({ reason } = {}) => {
          toast.info(reason || 'The host has ended this meeting.');
          leaveRoom();
        });

        sock.on('meeting-ended', ({ reason } = {}) => {
          toast.info(reason || 'The host has ended this meeting.');
          leaveRoom();
        });

        sock.on('room-users', (users) => {
          setParticipants(users);
          users.forEach((u) => {
            if (!peerConnections[u.socketId]) {
              sendOffer(u.socketId);
            }
          });
        });

        sock.on('user-joined', ({ socketId, userId, userName }) => {
          setParticipants((prev) => {
            if (prev.find((p) => p.socketId === socketId)) return prev;
            return [...prev, { socketId, userId, userName }];
          });
        });

        sock.on('offer', async ({ offer, from }) => {
          let pc = peerConnections[from];
          if (pc && pc.signalingState !== 'stable') {
            pc.close();
            delete peerConnections[from];
            pc = null;
          }
          if (!pc) pc = createPC(from);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sock.emit('answer', { to: from, answer, from: sock.id });
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        });

        sock.on('answer', async ({ answer, from }) => {
          const pc = peerConnections[from];
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error('Error setting answer:', err);
            }
          }
        });

        sock.on('ice-candidate', async ({ candidate, from }) => {
          const pc = peerConnections[from];
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          }
        });

        sock.on('user-left', ({ socketId }) => {
          if (peerConnections[socketId]) {
            peerConnections[socketId].close();
            delete peerConnections[socketId];
          }
          const el = document.getElementById(`remote-${socketId}`);
          if (el) el.srcObject = null;
          setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
          setRemoteHandRaised((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        });

        sock.on('chat-message', ({ message, from, timestamp }) => {
          const sender = participants.find((p) => p.socketId === from);
          setMessages((prev) => [
            ...prev,
            {
              text: message,
              sender: sender?.userName || 'Unknown',
              fromMe: false,
              timestamp,
            },
          ]);
        });

        sock.on('hand-raise', ({ userId, raised }) => {
          setParticipants((prev) => {
            const p = prev.find((x) => x.userId === userId);
            if (p) {
              setRemoteHandRaised((prevH) => ({
                ...prevH,
                [p.socketId]: raised,
              }));
            }
            return prev;
          });
        });

        function createPC(socketId) {
          if (peerConnections[socketId]) {
            peerConnections[socketId].close();
            delete peerConnections[socketId];
          }

          const pc = new RTCPeerConnection(ICE_SERVERS);
          peerConnections[socketId] = pc;

          const currentStream = screenStreamRef.current || localStreamRef.current;
          if (currentStream) {
            currentStream.getTracks().forEach((track) => {
              pc.addTrack(track, currentStream);
            });
          }

          pc.onicecandidate = (event) => {
            if (event.candidate && sock) {
              sock.emit('ice-candidate', {
                to: socketId,
                candidate: event.candidate,
                from: sock.id,
              });
            }
          };

          pc.ontrack = (event) => {
            updateRemoteVideo(socketId, event.streams[0]);
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              const el = document.getElementById(`remote-${socketId}`);
              if (el) el.srcObject = null;
            }
          };

          return pc;
        }

        async function sendOffer(socketId) {
          if (peerConnections[socketId]) return;
          const pc = createPC(socketId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sock.emit('offer', { to: socketId, offer, from: sock.id });
          } catch (err) {
            console.error('Error creating offer:', err);
          }
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };

    init();

    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      if (socketRef.current) socketRef.current.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [meetingId, user]);

  const replaceTrackOnAllPeers = useCallback(async (newTrack, kind) => {
    const peers = peerConnectionsRef.current;
    for (const socketId in peers) {
      const pc = peers[socketId];
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }
  }, []);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        socketRef.current?.emit('toggle-audio', {
          roomId: meetingId,
          userId: user.id,
          muted: !audioTrack.enabled,
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        socketRef.current?.emit('toggle-video', {
          roomId: meetingId,
          userId: user.id,
          off: !videoTrack.enabled,
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        await replaceTrackOnAllPeers(videoTrack, 'video');
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setScreenSharing(false);
      socketRef.current?.emit('screen-share-stopped', { roomId: meetingId });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        await replaceTrackOnAllPeers(screenTrack, 'video');
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setScreenSharing(true);
        socketRef.current?.emit('screen-share-started', { roomId: meetingId });
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error('Screen share cancelled:', err);
      }
    }
  };

  const toggleHandRaise = () => {
    const newRaised = !handRaised;
    setHandRaised(newRaised);
    socketRef.current?.emit('hand-raise', {
      roomId: meetingId,
      userId: user.id,
      raised: newRaised,
    });
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = {
      text: chatInput.trim(),
      sender: user.name,
      fromMe: true,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    socketRef.current?.emit('chat-message', {
      roomId: meetingId,
      message: chatInput.trim(),
    });
    setChatInput('');
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalParticipants = participants.length + 1;
  const hasAnyHandRaised = handRaised || Object.values(remoteHandRaised).some(Boolean);

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#070a13', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Glass Header */}
      <AppBar
        position="static"
        sx={{
          bgcolor: 'rgba(10, 14, 26, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Toolbar sx={{ minHeight: 64, px: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mr: 2 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: '#f43f5e',
                animation: 'livePulse 1.8s infinite',
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              VidCon
            </Typography>
          </Stack>

          <Chip
            icon={copied ? <CheckIcon sx={{ fontSize: '15px !important' }} /> : <ContentCopyIcon sx={{ fontSize: '15px !important' }} />}
            label={copied ? 'Copied!' : meetingId}
            onClick={copyMeetingId}
            size="small"
            sx={{
              color: '#ffffff',
              bgcolor: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: '1px solid',
              borderColor: copied ? '#10b981' : 'rgba(255, 255, 255, 0.15)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              mr: 1.5,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.12)',
              },
            }}
          />

          <Chip
            label={formatTime(meetingTime)}
            size="small"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              mr: 1.5,
            }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            icon={<PeopleIcon sx={{ fontSize: '15px !important', color: '#818cf8 !important' }} />}
            label={`${totalParticipants} online`}
            size="small"
            sx={{
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              color: '#e2e8f0',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              fontWeight: 700,
              fontSize: '0.78rem',
            }}
          />
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2.5 }, pb: 11, overflow: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: screenSharing
                ? '1fr'
                : `repeat(auto-fit, minmax(${totalParticipants > 2 ? '290px' : '420px'}, 1fr))`,
              gap: 2.5,
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: 1600,
              mx: 'auto',
              minHeight: '100%',
            }}
          >
            {/* Local Video Tile */}
            <Paper
              elevation={0}
              sx={{
                position: 'relative',
                bgcolor: '#0d1322',
                borderRadius: '20px',
                overflow: 'hidden',
                aspectRatio: screenSharing ? '16/7' : '16/9',
                border: screenSharing
                  ? '2px solid #10b981'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: screenSharing
                  ? '0 0 25px rgba(16, 185, 129, 0.3)'
                  : '0 12px 30px rgba(0, 0, 0, 0.6)',
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: screenSharing ? 'none' : 'scaleX(-1)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  zIndex: 2,
                }}
              >
                <Chip
                  label={`${user?.name} (You)`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(10, 14, 26, 0.75)',
                    backdropFilter: 'blur(10px)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                />
                {screenSharing && (
                  <Chip
                    label="Presenting"
                    size="small"
                    icon={<ScreenShareIcon sx={{ fontSize: '13px !important', color: '#10b981 !important' }} />}
                    sx={{
                      bgcolor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      fontWeight: 750,
                      fontSize: '0.72rem',
                    }}
                  />
                )}
              </Box>

              {!videoEnabled && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#0a0f1d',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    <Typography
                      variant="h3"
                      sx={{
                        fontFamily: '"Outfit", sans-serif',
                        fontWeight: 800,
                        color: '#ffffff',
                      }}
                    >
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                    Camera is muted
                  </Typography>
                </Box>
              )}

              {handRaised && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    p: 0.8,
                    borderRadius: '12px',
                    bgcolor: 'rgba(245, 158, 11, 0.25)',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <PanToolIcon sx={{ color: '#fbbf24', fontSize: 24 }} />
                </Box>
              )}
            </Paper>

            {/* Remote Participants */}
            {participants.map((p) => (
              <Paper
                key={p.socketId}
                elevation={0}
                sx={{
                  position: 'relative',
                  bgcolor: '#0d1322',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                }}
              >
                <video
                  id={`remote-${p.socketId}`}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <Box sx={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 1 }}>
                  <Chip
                    label={p.userName}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(10, 14, 26, 0.75)',
                      backdropFilter: 'blur(10px)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  />
                </Box>
                {remoteHandRaised[p.socketId] && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      p: 0.8,
                      borderRadius: '12px',
                      bgcolor: 'rgba(245, 158, 11, 0.25)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <PanToolIcon sx={{ color: '#fbbf24', fontSize: 24 }} />
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        </Box>

        {/* Chat / Participants Drawer */}
        <Drawer
          anchor="right"
          open={chatOpen || participantsOpen}
          onClose={() => {
            setChatOpen(false);
            setParticipantsOpen(false);
          }}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 380 },
              bgcolor: 'rgba(14, 20, 36, 0.96)',
              backdropFilter: 'blur(24px)',
              color: 'white',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {chatOpen && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800 }}>
                  In-Call Chat
                </Typography>
                <IconButton onClick={() => setChatOpen(false)} sx={{ color: 'white', borderRadius: 2 }}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
                {messages.length === 0 && (
                  <Box sx={{ textAlign: 'center', mt: 6, px: 2 }}>
                    <ChatIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                      No messages yet. Send a message to everyone in the room!
                    </Typography>
                  </Box>
                )}
                {messages.map((msg, i) => (
                  <Box
                    key={i}
                    sx={{
                      mb: 1.8,
                      textAlign: msg.fromMe ? 'right' : 'left',
                    }}
                  >
                    {!msg.fromMe && (
                      <Typography variant="caption" sx={{ color: '#818cf8', fontWeight: 700, display: 'block', mb: 0.5, ml: 0.5 }}>
                        {msg.sender}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        display: 'inline-block',
                        p: 1.6,
                        borderRadius: msg.fromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.fromMe
                          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                          : 'rgba(255, 255, 255, 0.08)',
                        maxWidth: '82%',
                        textAlign: 'left',
                        boxShadow: msg.fromMe ? '0 4px 14px rgba(99, 102, 241, 0.3)' : 'none',
                        border: msg.fromMe ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {msg.text}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Box>
              <Box sx={{ p: 2, display: 'flex', gap: 1.2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message to everyone…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                    },
                    '& .MuiInputBase-input::placeholder': { color: 'rgba(255, 255, 255, 0.4)' },
                  }}
                />
                <IconButton
                  onClick={sendMessage}
                  sx={{
                    bgcolor: '#6366f1',
                    color: '#ffffff',
                    borderRadius: '12px',
                    width: 42,
                    height: 42,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                    '&:hover': { bgcolor: '#4f46e5' },
                  }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>
          )}

          {participantsOpen && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800 }}>
                  Participants ({totalParticipants})
                </Typography>
                <IconButton onClick={() => setParticipantsOpen(false)} sx={{ color: 'white', borderRadius: 2 }}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              <List sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
                <ListItem
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                      }}
                    >
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={`${user?.name} (You)`}
                    secondary={handRaised ? '✋ Hand is raised' : 'Host'}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
                    secondaryTypographyProps={{ color: handRaised ? '#fbbf24' : '#94a3b8', fontSize: 12 }}
                  />
                </ListItem>
                {participants.map((p) => (
                  <ListItem
                    key={p.socketId}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: '10px',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 700,
                        }}
                      >
                        {p.userName?.charAt(0)?.toUpperCase()}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={p.userName}
                      secondary={remoteHandRaised[p.socketId] ? '✋ Hand is raised' : 'Participant'}
                      primaryTypographyProps={{ fontWeight: 650, fontSize: 14 }}
                      secondaryTypographyProps={{ color: remoteHandRaised[p.socketId] ? '#fbbf24' : '#94a3b8', fontSize: 12 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Drawer>
      </Box>

      {/* Modern Floating Control Dock */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          px: { xs: 2, sm: 3 },
          py: 1.25,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: { xs: 1, sm: 1.8 },
          borderRadius: '999px',
          bgcolor: 'rgba(14, 20, 36, 0.88)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Mic Toggle */}
        <Tooltip title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}>
          <IconButton
            onClick={toggleAudio}
            sx={{
              width: 46,
              height: 46,
              bgcolor: audioEnabled ? 'rgba(255, 255, 255, 0.08)' : '#f43f5e',
              color: 'white',
              border: '1px solid',
              borderColor: audioEnabled ? 'rgba(255, 255, 255, 0.12)' : '#f43f5e',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                bgcolor: audioEnabled ? 'rgba(255, 255, 255, 0.16)' : '#e11d48',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {audioEnabled ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Video Toggle */}
        <Tooltip title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}>
          <IconButton
            onClick={toggleVideo}
            sx={{
              width: 46,
              height: 46,
              bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.08)' : '#f43f5e',
              color: 'white',
              border: '1px solid',
              borderColor: videoEnabled ? 'rgba(255, 255, 255, 0.12)' : '#f43f5e',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.16)' : '#e11d48',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {videoEnabled ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Screen Share */}
        <Tooltip title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}>
          <IconButton
            onClick={toggleScreenShare}
            sx={{
              width: 46,
              height: 46,
              bgcolor: screenSharing ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
              color: 'white',
              border: '1px solid',
              borderColor: screenSharing ? '#10b981' : 'rgba(255, 255, 255, 0.12)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                bgcolor: screenSharing ? '#059669' : 'rgba(255, 255, 255, 0.16)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {screenSharing ? <StopScreenShareIcon fontSize="small" /> : <ScreenShareIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Hand Raise */}
        <Tooltip title={handRaised ? 'Lower Hand' : 'Raise Hand'}>
          <IconButton
            onClick={toggleHandRaise}
            sx={{
              width: 46,
              height: 46,
              bgcolor: handRaised ? '#fbbf24' : 'rgba(255, 255, 255, 0.08)',
              color: handRaised ? '#000' : 'white',
              border: '1px solid',
              borderColor: handRaised ? '#fbbf24' : 'rgba(255, 255, 255, 0.12)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                bgcolor: handRaised ? '#f59e0b' : 'rgba(255, 255, 255, 0.16)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            {handRaised ? <PanToolIcon fontSize="small" /> : <PanToolOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Chat Toggle */}
        <Badge
          badgeContent={messages.length}
          color="error"
          invisible={!chatOpen && messages.length === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 18, minWidth: 18, fontWeight: 800 } }}
        >
          <Tooltip title="In-Call Chat">
            <IconButton
              onClick={() => {
                setChatOpen(!chatOpen);
                setParticipantsOpen(false);
              }}
              sx={{
                width: 46,
                height: 46,
                bgcolor: chatOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                border: '1px solid',
                borderColor: chatOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  bgcolor: chatOpen ? '#4f46e5' : 'rgba(255, 255, 255, 0.16)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <ChatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Badge>

        {/* Participants Toggle */}
        <Tooltip title="Participants">
          <IconButton
            onClick={() => {
              setParticipantsOpen(!participantsOpen);
              setChatOpen(false);
            }}
            sx={{
              width: 46,
              height: 46,
              bgcolor: participantsOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
              color: 'white',
              border: '1px solid',
              borderColor: participantsOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.12)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                bgcolor: participantsOpen ? '#4f46e5' : 'rgba(255, 255, 255, 0.16)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <PeopleIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.15)', my: 0.8 }} />

        {/* Leave / End Controls */}
        {isHost ? (
          <Stack direction="row" spacing={1.2}>
            <Tooltip title="Leave call without terminating for others">
              <Button
                variant="outlined"
                onClick={leaveRoom}
                sx={{
                  borderRadius: '999px',
                  px: 2,
                  height: 44,
                  fontWeight: 650,
                  fontSize: '0.82rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                Leave
              </Button>
            </Tooltip>
            <Tooltip title="Terminate live meeting and disconnect all participants">
              <Button
                variant="contained"
                color="error"
                onClick={endMeetingForAll}
                startIcon={<CallEndIcon />}
                sx={{
                  borderRadius: '999px',
                  px: 2.4,
                  height: 44,
                  fontWeight: 750,
                  fontSize: '0.84rem',
                  background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                  boxShadow: '0 6px 20px rgba(244, 63, 94, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                    boxShadow: '0 8px 24px rgba(244, 63, 94, 0.55)',
                  },
                }}
              >
                End for All
              </Button>
            </Tooltip>
          </Stack>
        ) : (
          <Button
            variant="contained"
            color="error"
            onClick={leaveRoom}
            startIcon={<CallEndIcon />}
            sx={{
              borderRadius: '999px',
              px: 2.6,
              height: 44,
              fontWeight: 750,
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              boxShadow: '0 6px 20px rgba(244, 63, 94, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                boxShadow: '0 8px 24px rgba(244, 63, 94, 0.55)',
              },
            }}
          >
            Leave
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Room;
