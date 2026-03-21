import { Player } from '../models/Player.js';

// ============================================
// MULTIPLAYER CONFIGURATION
// ============================================
const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;

// ============================================
// MULTIPLAYER MANAGER CLASS
// ============================================

export class MultiplayerManager {
    constructor(arena) {
        this.arena = arena;
        this.socket = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.isConnected = false;
        this.mode = 'offline'; // 'offline', 'creating', 'joining', 'playing'
    }

    connect() {
        if (this.socket) return;
        console.log('[MULTIPLAYER] Connecting to server:', SOCKET_URL);
        this.socket = io(SOCKET_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });
        this.setupEventListeners();
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('[MULTIPLAYER] Connected to server');
            this.isConnected = true;
            this.playerId = this.socket.id;
            this.showNotification('Connected to server', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('[MULTIPLAYER] Disconnected from server');
            this.isConnected = false;
            this.showNotification('Disconnected from server', 'error');
        });

        this.socket.on('connect_error', (error) => {
            console.error('[MULTIPLAYER] Connection error:', error);
            this.showNotification('Connection failed. Server may be sleeping (wait 30s)', 'error');
        });

        this.socket.on('room:info', (data) => {
            this.updateRoomUI(data);
        });

        this.socket.on('room:playerJoined', (data) => {
            this.showNotification(`${data.playerName} joined the room`, 'info');
        });

        this.socket.on('room:playerLeft', (data) => {
            this.showNotification(`${data.playerName} left the room`, 'info');
        });

        this.socket.on('room:closed', (data) => {
            this.showNotification(data.reason, 'error');
            this.leaveRoom();
        });

        this.socket.on('game:started', (data) => {
            this.mode = 'playing';
            this.arena.modals.close('multiplayerLobby');
            document.getElementById('multiplayer-lobby-modal')?.classList.remove('visible');
            document.getElementById('room-modal')?.classList.remove('visible');
            document.getElementById('join-modal')?.classList.remove('visible');

            const lobbyView = document.getElementById('lobby-view');
            const arenaView = document.getElementById('arena-view');
            const loadingScreen = document.getElementById('loading-screen');

            if (loadingScreen) loadingScreen.classList.remove('hidden');

            setTimeout(() => {
                if (lobbyView) lobbyView.classList.add('hidden');
                if (arenaView) arenaView.classList.remove('hidden');
                if (loadingScreen) loadingScreen.classList.add('hidden');

                if (data.gameState) this.receiveGameState(data.gameState);

                this.arena.log.add('🎮 Multiplayer game started! All players connected.', 'system');
                this.arena.renderer.renderAll();
                this.showNotification('Game started! Battle begins!', 'success');
            }, 1500);
        });

        this.socket.on('game:update', (data) => {
            if (data.gameState) this.receiveGameState(data.gameState);
        });

        this.socket.on('game:action', (data) => {
            this.handleRemoteAction(data.action, data.payload);
        });

        this.socket.on('chat:message', (data) => {
            this.displayChatMessage(data);
        });
    }

    createRoom(playerName) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        this.socket.emit('room:create', { playerName }, (response) => {
            if (response.success) {
                this.roomCode = response.roomCode;
                this.playerId = response.playerId;
                this.isHost = true;
                this.mode = 'creating';
                this.showNotification(`Room created: ${this.roomCode}`, 'success');
                this.showRoomLobby();
            } else {
                this.showNotification(`Error: ${response.error}`, 'error');
            }
        });
    }

    joinRoom(roomCode, playerName) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        this.socket.emit('room:join', { roomCode, playerName }, (response) => {
            if (response.success) {
                this.roomCode = response.roomCode;
                this.playerId = response.playerId;
                this.isHost = false;
                this.mode = 'joining';
                this.showNotification('Joined room successfully', 'success');
                this.showRoomLobby();
            } else {
                this.showNotification(`Error: ${response.error}`, 'error');
            }
        });
    }

    leaveRoom() {
        this.roomCode = null;
        this.isHost = false;
        this.mode = 'offline';
        this.arena.modals.close('multiplayerLobby');
    }

    toggleReady() {
        if (!this.roomCode) return;
        this.socket.emit('player:ready', {}, () => {});
    }

    startGame() {
        if (!this.isHost) {
            this.showNotification('Only the host can start the game', 'error');
            return;
        }
        const serializedState = this.serializeGameState();
        this.socket.emit('game:start', { gameState: serializedState }, (response) => {
            if (!response.success) this.showNotification(`Error: ${response.error}`, 'error');
        });
    }

    sendGameState() {
        if (!this.roomCode || this.mode !== 'playing') return;
        try {
            const gameState = this.serializeGameState();
            this.socket.emit('game:sync', { gameState }, (response) => {
                if (!response || !response.success) {
                    console.error('[MULTIPLAYER] Failed to sync game state', response);
                }
            });
        } catch (err) {
            console.error('[MULTIPLAYER] Error serializing game state:', err);
        }
    }

    receiveGameState(gameState) {
        try {
            this.deserializeGameState(gameState);
            this.arena.renderer.renderAll();
        } catch (err) {
            console.error('[MULTIPLAYER] Error deserializing game state:', err);
        }
    }

    sendAction(action, payload) {
        if (!this.roomCode || this.mode !== 'playing') return;
        this.socket.emit('game:action', { action, payload });
    }

    handleRemoteAction(action, payload) {
        switch (action) {
            case 'log_add':
                if (payload) {
                    this.arena.log._buffer.push(payload);
                    this.arena.log._render();
                }
                break;
            case 'attack': break;
            case 'heal': break;
            case 'statusEffect': break;
            default: console.warn('[MULTIPLAYER] Unknown action:', action);
        }
    }

    serializeGameState() {
        const gs = this.arena.gs;
        return {
            players: gs.players.map(p => p.toJSON()),
            round: gs.round,
            weather: gs.weather,
            activeTurnPlayerId: gs.activeTurnPlayerId,
            selectedAttackTargetId: gs.selectedAttackTargetId,
            selectedStatusTargetId: gs.selectedStatusTargetId,
            logs: this.arena.log._buffer.toArray()
        };
    }

    deserializeGameState(state) {
        const gs = this.arena.gs;
        gs.players = state.players.map(p => Player.fromJSON(p, this.arena.db));
        gs.round = state.round;
        gs.weather = state.weather;
        gs.activeTurnPlayerId = state.activeTurnPlayerId;
        gs.selectedAttackTargetId = state.selectedAttackTargetId;
        gs.selectedStatusTargetId = state.selectedStatusTargetId;
        if (state.logs && state.logs.length > 0) {
            this.arena.log.loadLogs(state.logs);
        }
    }

    showRoomLobby() {
        this.arena.modals.open('multiplayerLobby');
        const codeDisplay = document.getElementById('room-code-display');
        if (codeDisplay) codeDisplay.textContent = this.roomCode;
    }

    updateRoomUI(data) {
        const playerList = document.getElementById('room-player-list');
        if (!playerList) return;
        playerList.innerHTML = data.players.map(p => `
            <div class="player-item ${p.isHost ? 'host' : ''}">
                <span class="player-name">${p.name}</span>
                ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
                ${p.isReady ? '<span class="ready-badge">READY</span>' : ''}
            </div>
        `).join('');
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.style.display = this.isHost ? 'block' : 'none';
    }

    showNotification(message, type = 'info') {
        this.arena._announce(message, type === 'error');
    }

    displayChatMessage(data) {
        const message = `[CHAT] ${data.playerName}: ${data.message}`;
        this.arena.log.add(message, 'system');
    }
}
