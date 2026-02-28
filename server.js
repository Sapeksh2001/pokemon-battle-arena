/**
 * POKÉMON BATTLE ARENA - MULTIPLAYER SERVER
 * ==========================================
 * Node.js + Express + Socket.IO
 * 
 * Features:
 * - Room creation with 6-digit codes
 * - Real-time state synchronization
 * - Support for 2-6 players per room
 * - Turn management
 * - Automatic cleanup of inactive rooms
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration — allow all origins so the deployed URL works
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve frontend files

// ============================================
// DATA STRUCTURES
// ============================================

/**
 * rooms: Map<roomCode, Room>
 * Room structure:
 * {
 *   code: string,
 *   host: string (socketId),
 *   players: Map<socketId, PlayerData>,
 *   gameState: object,
 *   createdAt: timestamp,
 *   lastActivity: timestamp,
 *   isStarted: boolean
 * }
 */
const rooms = new Map();

/**
 * socketToRoom: Map<socketId, roomCode>
 * Quick lookup for which room a socket belongs to
 */
const socketToRoom = new Map();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a random 6-digit room code
 */
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms.has(code));
    return code;
}

/**
 * Clean up inactive rooms (no activity for 30 minutes)
 */
function cleanupInactiveRooms() {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    
    for (const [code, room] of rooms.entries()) {
        if (now - room.lastActivity > THIRTY_MINUTES) {
            console.log(`[CLEANUP] Removing inactive room: ${code}`);
            rooms.delete(code);
            
            // Notify remaining players
            io.to(code).emit('room:closed', {
                reason: 'Room closed due to inactivity'
            });
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveRooms, 5 * 60 * 1000);

/**
 * Update room's last activity timestamp
 */
function touchRoom(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        room.lastActivity = Date.now();
    }
}

/**
 * Broadcast room info to all players in the room
 */
function broadcastRoomInfo(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const playerList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.id === room.host,
        isReady: p.isReady
    }));
    
    io.to(roomCode).emit('room:info', {
        code: roomCode,
        players: playerList,
        isStarted: room.isStarted,
        maxPlayers: 6
    });
}

// ============================================
// HTTP ENDPOINTS (for health checks)
// ============================================

// GET / is handled by express.static → serves index.html

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        name: 'Pokémon Battle Arena Server',
        version: '1.0.0',
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

app.get('/stats', (req, res) => {
    const roomStats = Array.from(rooms.values()).map(room => ({
        code: room.code,
        players: room.players.size,
        isStarted: room.isStarted,
        age: Math.floor((Date.now() - room.createdAt) / 1000) + 's'
    }));
    
    res.json({
        totalRooms: rooms.size,
        totalConnections: io.engine.clientsCount,
        rooms: roomStats
    });
});

// ============================================
// SOCKET.IO CONNECTION HANDLING
// ============================================

io.on('connection', (socket) => {
    console.log(`[CONNECT] Socket connected: ${socket.id}`);
    
    // ────────────────────────────────────────
    // ROOM CREATION
    // ────────────────────────────────────────
    
    socket.on('room:create', (data, callback) => {
        try {
            const { playerName } = data;
            
            if (!playerName || playerName.trim() === '') {
                return callback({ success: false, error: 'Player name is required' });
            }
            
            const roomCode = generateRoomCode();
            
            const room = {
                code: roomCode,
                host: socket.id,
                players: new Map(),
                gameState: null,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                isStarted: false
            };
            
            // Add host as first player
            room.players.set(socket.id, {
                id: socket.id,
                name: playerName.trim(),
                isReady: false
            });
            
            rooms.set(roomCode, room);
            socketToRoom.set(socket.id, roomCode);
            
            socket.join(roomCode);
            
            console.log(`[ROOM] Created room ${roomCode} by ${playerName}`);
            
            callback({ 
                success: true, 
                roomCode,
                playerId: socket.id
            });
            
            broadcastRoomInfo(roomCode);
            
        } catch (error) {
            console.error('[ERROR] room:create', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // ROOM JOINING
    // ────────────────────────────────────────
    
    socket.on('room:join', (data, callback) => {
        try {
            const { roomCode, playerName } = data;
            
            if (!roomCode || !playerName) {
                return callback({ success: false, error: 'Room code and player name required' });
            }
            
            const room = rooms.get(roomCode);
            
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }
            
            if (room.players.size >= 6) {
                return callback({ success: false, error: 'Room is full (max 6 players)' });
            }
            
            if (room.isStarted) {
                return callback({ success: false, error: 'Game already started' });
            }
            
            // Add player to room
            room.players.set(socket.id, {
                id: socket.id,
                name: playerName.trim(),
                isReady: false
            });
            
            socketToRoom.set(socket.id, roomCode);
            socket.join(roomCode);
            touchRoom(roomCode);
            
            console.log(`[ROOM] ${playerName} joined room ${roomCode}`);
            
            callback({ 
                success: true, 
                roomCode,
                playerId: socket.id
            });
            
            // Notify all players
            io.to(roomCode).emit('room:playerJoined', {
                playerId: socket.id,
                playerName: playerName.trim()
            });
            
            broadcastRoomInfo(roomCode);
            
        } catch (error) {
            console.error('[ERROR] room:join', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // PLAYER READY TOGGLE
    // ────────────────────────────────────────
    
    socket.on('player:ready', (data, callback) => {
        try {
            const roomCode = socketToRoom.get(socket.id);
            if (!roomCode) {
                return callback?.({ success: false, error: 'Not in a room' });
            }
            
            const room = rooms.get(roomCode);
            const player = room.players.get(socket.id);
            
            if (player) {
                player.isReady = !player.isReady;
                touchRoom(roomCode);
                
                console.log(`[READY] ${player.name} is ${player.isReady ? 'ready' : 'not ready'}`);
                
                callback?.({ success: true, isReady: player.isReady });
                broadcastRoomInfo(roomCode);
            }
            
        } catch (error) {
            console.error('[ERROR] player:ready', error);
            callback?.({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // GAME START (HOST ONLY)
    // ────────────────────────────────────────
    
    socket.on('game:start', (data, callback) => {
        try {
            const roomCode = socketToRoom.get(socket.id);
            if (!roomCode) {
                return callback({ success: false, error: 'Not in a room' });
            }
            
            const room = rooms.get(roomCode);
            
            // Only host can start
            if (room.host !== socket.id) {
                return callback({ success: false, error: 'Only host can start the game' });
            }
            
            // Check if all players are ready
            const allReady = Array.from(room.players.values()).every(p => p.isReady || p.id === room.host);
            
            if (!allReady) {
                return callback({ success: false, error: 'Not all players are ready' });
            }
            
            if (room.players.size < 2) {
                return callback({ success: false, error: 'Need at least 2 players to start' });
            }
            
            room.isStarted = true;
            room.gameState = data.gameState || null;
            touchRoom(roomCode);
            
            console.log(`[GAME] Starting game in room ${roomCode} with ${room.players.size} players`);
            
            callback({ success: true });
            
            // Notify all players
            io.to(roomCode).emit('game:started', {
                gameState: room.gameState
            });
            
        } catch (error) {
            console.error('[ERROR] game:start', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // GAME STATE SYNC
    // ────────────────────────────────────────
    
    socket.on('game:sync', (data, callback) => {
        try {
            const roomCode = socketToRoom.get(socket.id);
            if (!roomCode) return;
            
            const room = rooms.get(roomCode);
            if (!room || !room.isStarted) return;
            
            room.gameState = data.gameState;
            touchRoom(roomCode);
            
            // Broadcast to all other players in room
            socket.to(roomCode).emit('game:update', {
                gameState: data.gameState,
                from: socket.id
            });
            
            callback?.({ success: true });
            
        } catch (error) {
            console.error('[ERROR] game:sync', error);
            callback?.({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // SPECIFIC GAME ACTIONS
    // ────────────────────────────────────────
    
    socket.on('game:action', (data, callback) => {
        try {
            const roomCode = socketToRoom.get(socket.id);
            if (!roomCode) return;
            
            const room = rooms.get(roomCode);
            if (!room || !room.isStarted) return;
            
            touchRoom(roomCode);
            
            // Broadcast action to all other players
            socket.to(roomCode).emit('game:action', {
                action: data.action,
                payload: data.payload,
                from: socket.id
            });
            
            callback?.({ success: true });
            
        } catch (error) {
            console.error('[ERROR] game:action', error);
            callback?.({ success: false, error: error.message });
        }
    });
    
    // ────────────────────────────────────────
    // CHAT MESSAGES
    // ────────────────────────────────────────
    
    socket.on('chat:message', (data) => {
        try {
            const roomCode = socketToRoom.get(socket.id);
            if (!roomCode) return;
            
            const room = rooms.get(roomCode);
            const player = room.players.get(socket.id);
            
            if (player) {
                touchRoom(roomCode);
                
                io.to(roomCode).emit('chat:message', {
                    from: socket.id,
                    playerName: player.name,
                    message: data.message,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[ERROR] chat:message', error);
        }
    });
    
    // ────────────────────────────────────────
    // DISCONNECTION
    // ────────────────────────────────────────
    
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
        
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode) return;
        
        const room = rooms.get(roomCode);
        if (!room) return;
        
        const player = room.players.get(socket.id);
        const playerName = player ? player.name : 'Unknown';
        
        // Remove player from room
        room.players.delete(socket.id);
        socketToRoom.delete(socket.id);
        
        console.log(`[ROOM] ${playerName} left room ${roomCode}`);
        
        // If room is empty, delete it
        if (room.players.size === 0) {
            console.log(`[ROOM] Deleting empty room ${roomCode}`);
            rooms.delete(roomCode);
            return;
        }
        
        // If host left, assign new host
        if (room.host === socket.id) {
            const newHost = room.players.keys().next().value;
            room.host = newHost;
            console.log(`[ROOM] New host in room ${roomCode}: ${newHost}`);
        }
        
        // Notify remaining players
        io.to(roomCode).emit('room:playerLeft', {
            playerId: socket.id,
            playerName: playerName
        });
        
        broadcastRoomInfo(roomCode);
    });
    
    // ────────────────────────────────────────
    // ERROR HANDLING
    // ────────────────────────────────────────
    
    socket.on('error', (error) => {
        console.error('[SOCKET ERROR]', error);
    });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  POKÉMON BATTLE ARENA - MULTIPLAYER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  Status: http://localhost:${PORT}/health`);
    console.log(`  Stats:  http://localhost:${PORT}/stats`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Waiting for connections...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received, closing server...');
    server.close(() => {
        console.log('[SHUTDOWN] Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT received, closing server...');
    server.close(() => {
        console.log('[SHUTDOWN] Server closed');
        process.exit(0);
    });
});
