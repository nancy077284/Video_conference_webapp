# VidCon - Real-Time Video Conferencing & Collaboration Platform

VidCon is a modern, high-performance video conferencing application built with React, Node.js, Express, Socket.IO, and WebRTC. It provides seamless peer-to-peer audio/video streaming, instant room creation, meeting scheduling, in-call chat, and comprehensive host management controls.

---

## Key Features

- **HD Video & Audio:** Low-latency WebRTC peer-to-peer audio and video calls.
- **Instant & Scheduled Meetings:** Launch a meeting in seconds or schedule upcoming sessions with invite links.
- **Host Controls:** 
  - Terminate and end live meetings for all participants.
  - Delete past meeting history or clear entire archives.
  - Mute/unmute, screen share, and raise hand interactions.
- **In-Meeting Collaboration:** Real-time chat messages, participant lists, and screen sharing.
- **Modern Glassmorphic UI:** Responsive design with dark/light theme support, micro-animations, and intuitive controls.
- **Flexible Storage:** Powered by MongoDB (Atlas Cloud or local) with JWT authentication.

---

## Tech Stack

- **Frontend:** React 18, React Router 6, Material-UI (MUI 5), Socket.IO Client.
- **Backend:** Node.js, Express, Socket.IO, Mongoose (MongoDB).
- **Communication:** WebRTC (PeerConnection, STUN/TURN signaling).

---

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm (v8 or newer)
- MongoDB instance (MongoDB Atlas cluster or local MongoDB)

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd video_conferencing
   ```

2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Set up environment variables:
   Copy `.env.example` to `backend/.env`:
   ```bash
   cp .env.example backend/.env
   ```
   Configure your MongoDB connection string in `backend/.env`:
   ```env
   PORT=5050
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/vidconapp?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key
   ```

4. Build the frontend bundle:
   ```bash
   npm run build
   ```

5. Start the production server:
   ```bash
   npm start
   ```
   Open [http://localhost:5050](http://localhost:5050) in your browser.

---

## Development Mode

To run backend and frontend independently with hot reloading:

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5050`

---



## License

This project is licensed under the MIT License.
