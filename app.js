const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity, or restrict to your Vercel URL
    methods: ["GET", "POST"]
  }
});

// Map socketId -> { userId, lastActive }
let clients = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    // 1. Register the user
    clients.set(socket.id, { userId, lastActive: Date.now() });
    
    // 2. Broadcast to OTHERS that this user is online
    io.emit('user_online', { userId: userId });

    // 3. Send the NEW USER the list of CURRENTLY online users
    const onlineUserIds = Array.from(clients.values()).map(c => c.userId);
    // Use a Set to remove duplicates if a user has multiple tabs open
    const uniqueOnlineIds = [...new Set(onlineUserIds)];
    socket.emit('online_users', uniqueOnlineIds);
  });

  // ========== ACTIVITY / HEARTBEAT ==========
  socket.on('user_active', (userId) => {
    const client = clients.get(socket.id);
    if (client) {
      client.lastActive = Date.now();
      clients.set(socket.id, client);
      // You could emit a 'user_status_change' here if you want to track 'away' vs 'active'
    }
  });

  // ========== TYPING INDICATORS ==========
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.broadcast.emit('stop_typing', data);
  });

  socket.on('disconnect', () => {
    const client = clients.get(socket.id);
    if (client) {
      io.emit('user_offline', client.userId);
      clients.delete(socket.id);
      console.log('User disconnected:', client.userId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});