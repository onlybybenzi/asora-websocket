const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

let onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    onlineUsers.set(socket.id, userId);
    io.emit('user_online', { userId: userId, status: 'online' });
  });

  socket.on('change_status', (status) => {
    const userId = onlineUsers.get(socket.id);
    if(userId) {
       io.emit('user_status_change', { userId, status });
    }
  });

  // ========== TYPING INDICATORS ==========
  socket.on('typing', (data) => {
    // data = { chatId: string, userId: string }
    socket.broadcast.emit('typing', data);
  });

  socket.on('stop_typing', (data) => {
    // data = { chatId: string, userId: string }
    socket.broadcast.emit('stop_typing', data);
  });
  // ========================================

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