const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Allow your Next.js frontend to connect
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

// Store user statuses in memory (or Redis for scaling later)
let onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. User logs in -> Client emits "join" event with their User ID
  socket.on('join', (userId) => {
    onlineUsers.set(socket.id, userId);
    
    // Broadcast to everyone that this user is online
    io.emit('user_online', { userId: userId, status: 'online' });
  });

  // 2. User sets status to DND/Idle
  socket.on('change_status', (status) => {
    const userId = onlineUsers.get(socket.id);
    if(userId) {
       io.emit('user_status_change', { userId, status });
    }
  });

  // 3. User disconnects (Closes tab/Internet dies) -> AUTOMATIC
  socket.on('disconnect', () => {
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      io.emit('user_offline', userId);
      onlineUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});