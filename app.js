const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Map socketId -> { userId, lastActive }
let clients = new Map();

// Map to track read cursors: chatId -> Map<userId, { messageId, username, avatar }>
let readCursors = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    clients.set(socket.id, { userId, lastActive: Date.now() });
    
    // Join a room for this user so we can message them easily
    socket.join(userId);

    io.emit('user_online', { userId: userId });

    const onlineUserIds = Array.from(clients.values()).map(c => c.userId);
    const uniqueOnlineIds = [...new Set(onlineUserIds)];
    socket.emit('online_users', uniqueOnlineIds);
  });

  socket.on('user_active', (userId) => {
    const client = clients.get(socket.id);
    if (client) {
      client.lastActive = Date.now();
      clients.set(socket.id, client);
    }
  });

  // ========== MESSAGING ==========
  socket.on('send_message', (data) => {
    // data = { chatId, recipientIds, message }
    if (data.recipientIds && Array.isArray(data.recipientIds)) {
      data.recipientIds.forEach(recipientId => {
        io.to(recipientId).emit('new_message', {
          chatId: data.chatId,
          message: data.message
        });
      });
    }
  });

  // ========== READ CURSORS (Mark as Read) ==========
  socket.on('mark_chat_read', (data) => {
    // data = { chatId, messageId, userId, username, avatar }
    const { chatId, messageId, userId, username, avatar } = data;
    
    // Store the read cursor
    if (!readCursors.has(chatId)) {
      readCursors.set(chatId, new Map());
    }
    readCursors.get(chatId).set(userId, { messageId, username, avatar });
    
    // Broadcast to others in this chat that this user has read up to this message
    socket.broadcast.emit('user_read_receipt', {
      chatId,
      userId,
      username,
      avatar,
      messageId
    });
    
    console.log(`User ${username} read chat ${chatId} up to message ${messageId}`);
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