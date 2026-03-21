/**
 * MULTIPLAYER INTEGRATION FOR POKÉMON BATTLE ARENA
 * ==================================================
 * 
 * Add this code to your existing script.js file.
 * 
 * STEP 1: Add Socket.IO client to index.html
 * Add this line in <head> section BEFORE your script.js:
 * <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
 * 
 * STEP 2: Add this code at the TOP of your script.js (after class definitions)
 */

// ============================================
// MULTIPLAYER CONFIGURATION
// ============================================

// Change this URL based on environment:
// Local:      'http://localhost:3001'
// Production: 'https://your-server.onrender.com'
const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:3001'
    : 'https://pokemon-battle-server.onrender.com';

// ============================================
// MULTIPLAYER MANAGER CLASS
// ============================================

class MultiplayerManager {
    constructor(arena) {
        this.arena = arena;
        this.socket = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.isConnected = false;
        this.mode = 'offline'; // 'offline', 'creating', 'joining', 'playing'
    }
    
    // ── CONNECTION ──────────────────────────────────────
    
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
    
    // ── EVENT LISTENERS ─────────────────────────────────
    
    setupEventListeners() {
        // Connection events
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
        
        // Room events
        this.socket.on('room:info', (data) => {
            console.log('[MULTIPLAYER] Room info:', data);
            this.updateRoomUI(data);
        });
        
        this.socket.on('room:playerJoined', (data) => {
            console.log('[MULTIPLAYER] Player joined:', data);
            this.showNotification(`${data.playerName} joined the room`, 'info');
        });
        
        this.socket.on('room:playerLeft', (data) => {
            console.log('[MULTIPLAYER] Player left:', data);
            this.showNotification(`${data.playerName} left the room`, 'info');
        });
        
        this.socket.on('room:closed', (data) => {
            console.log('[MULTIPLAYER] Room closed:', data);
            this.showNotification(data.reason, 'error');
            this.leaveRoom();
        });
        
        // Game events
        this.socket.on('game:started', (data) => {
            console.log('[MULTIPLAYER] Game started:', data);
            this.mode = 'playing';
            this.arena.modals.close('multiplayerLobby');
            if (data.gameState) {
                this.receiveGameState(data.gameState);
            }
        });
        
        this.socket.on('game:update', (data) => {
            console.log('[MULTIPLAYER] Game update from:', data.from);
            if (data.gameState) {
                this.receiveGameState(data.gameState);
            }
        });
        
        this.socket.on('game:action', (data) => {
            console.log('[MULTIPLAYER] Action from:', data.from, data.action);
            this.handleRemoteAction(data.action, data.payload);
        });
        
        // Chat events
        this.socket.on('chat:message', (data) => {
            console.log('[MULTIPLAYER] Chat:', data);
            this.displayChatMessage(data);
        });
    }
    
    // ── ROOM MANAGEMENT ─────────────────────────────────
    
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
                console.log('[MULTIPLAYER] Room created:', this.roomCode);
                this.showNotification(`Room created: ${this.roomCode}`, 'success');
                this.showRoomLobby();
            } else {
                console.error('[MULTIPLAYER] Failed to create room:', response.error);
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
                console.log('[MULTIPLAYER] Joined room:', this.roomCode);
                this.showNotification('Joined room successfully', 'success');
                this.showRoomLobby();
            } else {
                console.error('[MULTIPLAYER] Failed to join room:', response.error);
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
        
        this.socket.emit('player:ready', {}, (response) => {
            if (response.success) {
                console.log('[MULTIPLAYER] Ready status:', response.isReady);
            }
        });
    }
    
    startGame() {
        if (!this.isHost) {
            this.showNotification('Only the host can start the game', 'error');
            return;
        }
        
        const gameState = this.arena.gs;
        
        this.socket.emit('game:start', { gameState }, (response) => {
            if (response.success) {
                console.log('[MULTIPLAYER] Game starting...');
            } else {
                this.showNotification(`Error: ${response.error}`, 'error');
            }
        });
    }
    
    // ── GAME STATE SYNCHRONIZATION ─────────────────────
    
    sendGameState() {
        if (!this.roomCode || this.mode !== 'playing') return;
        
        const gameState = this.serializeGameState();
        
        this.socket.emit('game:sync', { gameState }, (response) => {
            if (!response || !response.success) {
                console.error('[MULTIPLAYER] Failed to sync game state');
            }
        });
    }
    
    receiveGameState(gameState) {
        // Deserialize and apply to local game
        this.deserializeGameState(gameState);
        this.arena.renderer.renderAll();
    }
    
    sendAction(action, payload) {
        if (!this.roomCode || this.mode !== 'playing') return;
        
        this.socket.emit('game:action', { action, payload });
    }
    
    handleRemoteAction(action, payload) {
        // Handle specific actions received from other players
        switch (action) {
            case 'attack':
                // Apply attack without re-sending
                break;
            case 'heal':
                // Apply heal without re-sending
                break;
            case 'statusEffect':
                // Apply status effect without re-sending
                break;
            default:
                console.warn('[MULTIPLAYER] Unknown action:', action);
        }
    }
    
    // ── SERIALIZATION ───────────────────────────────────
    
    serializeGameState() {
        // Return a JSON-serializable version of game state
        const gs = this.arena.gs;
        return {
            players: gs.players.map(p => p.toJSON()),
            round: gs.round,
            weather: gs.weather,
            activeTurnPlayerId: gs.activeTurnPlayerId,
            selectedAttackTargetId: gs.selectedAttackTargetId,
            selectedStatusTargetId: gs.selectedStatusTargetId
        };
    }
    
    deserializeGameState(state) {
        // Apply received state to local game
        const gs = this.arena.gs;
        gs.players = state.players.map(p => Player.fromJSON(p, this.arena.db));
        gs.round = state.round;
        gs.weather = state.weather;
        gs.activeTurnPlayerId = state.activeTurnPlayerId;
        gs.selectedAttackTargetId = state.selectedAttackTargetId;
        gs.selectedStatusTargetId = state.selectedStatusTargetId;
    }
    
    // ── UI HELPERS ──────────────────────────────────────
    
    showRoomLobby() {
        // Show lobby modal with room info
        this.arena.modals.open('multiplayerLobby');
        
        // Update UI with room code
        const codeDisplay = document.getElementById('room-code-display');
        if (codeDisplay) {
            codeDisplay.textContent = this.roomCode;
        }
    }
    
    updateRoomUI(data) {
        // Update lobby UI with player list
        const playerList = document.getElementById('room-player-list');
        if (!playerList) return;
        
        playerList.innerHTML = data.players.map(p => `
            <div class="player-item ${p.isHost ? 'host' : ''}">
                <span class="player-name">${p.name}</span>
                ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
                ${p.isReady ? '<span class="ready-badge">READY</span>' : ''}
            </div>
        `).join('');
        
        // Update start button visibility
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.style.display = this.isHost ? 'block' : 'none';
        }
    }
    
    showNotification(message, type = 'info') {
        // Use existing announcement system
        this.arena._announce(message, type === 'error');
    }
    
    displayChatMessage(data) {
        // Add chat message to battle log
        const message = `[CHAT] ${data.playerName}: ${data.message}`;
        this.arena.log.add(message, 'system');
    }
}

// ============================================
// INTEGRATION WITH EXISTING CODE
// ============================================

/**
 * Add this to your PokemonBattleArena constructor:
 * 
 * constructor() {
 *     // ... existing code ...
 *     
 *     // Add multiplayer manager
 *     this.multiplayer = new MultiplayerManager(this);
 * }
 */

/**
 * Add this to your PokemonBattleArena init() method:
 * 
 * init() {
 *     // ... existing code ...
 *     
 *     // Setup multiplayer UI
 *     this._setupMultiplayerUI();
 * }
 */

/**
 * Add this method to PokemonBattleArena class:
 */
_setupMultiplayerUI() 
{
    // Add multiplayer buttons to lobby
    const lobbyControls = document.querySelector('#lobby-view .space-y-4');
    if (lobbyControls) {
        const multiplayerHTML = `
            <button onclick="window.createMultiplayerRoom()" 
                    class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 text-lg">
                🌐 Create Multiplayer Room
            </button>
            <button onclick="window.joinMultiplayerRoom()" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 text-lg">
                🚪 Join Multiplayer Room
            </button>
        `;
        lobbyControls.insertAdjacentHTML('beforeend', multiplayerHTML);
    }
    
    // Expose methods to global scope
    window.createMultiplayerRoom = () => {
        const name = prompt('Enter your trainer name:');
        if (name) {
            this.multiplayer.connect();
            setTimeout(() => this.multiplayer.createRoom(name), 500);
        }
    };
    
    window.joinMultiplayerRoom = () => {
        const code = prompt('Enter 6-digit room code:');
        const name = prompt('Enter your trainer name:');
        if (code && name) {
            this.multiplayer.connect();
            setTimeout(() => this.multiplayer.joinRoom(code, name), 500);
        }
    };
}

/**
 * Modify your action handlers to send multiplayer updates:
 * 
 * In handleAttack(), handleStatUpdate(), etc., add:
 * 
 * if (this.multiplayer.mode === 'playing') {
 *     this.multiplayer.sendGameState();
 * }
 */

// ============================================
// EXAMPLE: Modified handleAttack() with multiplayer
// ============================================

/*
handleAttack(attackType) {
    // ... existing attack logic ...
    
    // At the end, after state changes:
    if (this.multiplayer.mode === 'playing') {
        this.multiplayer.sendGameState();
    }
}
*/

// ============================================
// LOBBY MODAL HTML (add to index.html)
// ============================================

/*
Add this modal to your index.html, after existing modals:

<div id="multiplayer-lobby-modal" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Multiplayer Lobby</h2>
            <button onclick="window.arena.multiplayer.leaveRoom()" class="close-btn">×</button>
        </div>
        <div class="modal-body">
            <div class="room-code-section">
                <h3>Room Code</h3>
                <div id="room-code-display" class="room-code"></div>
                <p class="text-sm">Share this code with friends</p>
            </div>
            
            <div class="players-section">
                <h3>Players</h3>
                <div id="room-player-list"></div>
            </div>
            
            <div class="controls">
                <button id="ready-btn" 
                        onclick="window.arena.multiplayer.toggleReady()"
                        class="btn-primary">
                    Toggle Ready
                </button>
                <button id="start-game-btn" 
                        onclick="window.arena.multiplayer.startGame()"
                        class="btn-success"
                        style="display: none;">
                    Start Game
                </button>
            </div>
        </div>
    </div>
</div>
*/

// ============================================
// CSS STYLES (add to style.css)
// ============================================

/*
Add this CSS to your style.css:

.room-code {
    font-size: 3rem;
    font-weight: bold;
    text-align: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    letter-spacing: 0.5rem;
    margin: 1rem 0;
}

.players-section {
    margin: 2rem 0;
}

.player-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    margin: 0.5rem 0;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}

.player-item.host {
    border-left: 4px solid #fbbf24;
}

.host-badge {
    background: #fbbf24;
    color: #000;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: bold;
}

.ready-badge {
    background: #10b981;
    color: #fff;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: bold;
}
*/

console.log('[MULTIPLAYER] Integration code loaded');
