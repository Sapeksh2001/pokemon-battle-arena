import { typeChart, typeColors, arenaBackgrounds } from './data/constants.js';
import { PokemonDatabase } from './services/PokemonDatabase.js';
import { Pokemon } from './models/Pokemon.js';
import { Player } from './models/Player.js';
import { applyModification, escapeHTML } from './utils/helpers.js';
import { AudioManager } from './services/AudioManager.js';
import { BattleEngine } from './services/BattleEngine.js';
import { BattleLog } from './services/BattleLog.js';
import { HistoryManager } from './services/HistoryManager.js';
import { ModalManager } from './ui/ModalManager.js';
import { Timer } from './ui/Timer.js';
import { UIRenderer } from './ui/UIRenderer.js';
import { MultiplayerManager } from './api/socketClient.js';

export class PokemonBattleArena {
    constructor() {
        this.audio = new AudioManager();
        this.db = new PokemonDatabase(window.MergedPokemonData || {});
        this.engine = new BattleEngine(typeChart);
        this.log = new BattleLog(200);
        this.history = new HistoryManager(30);
        this.modals = new ModalManager();
        this.timer = new Timer(120);
        this.multiplayer = new MultiplayerManager(this);
        this.gs = {
            players: [], round: 1, weather: 'none',
            activeTurnPlayerId: null, selectedAttackTargetId: null, selectedStatusTargetId: null,
            currentEditing: { playerId: null, slotId: null }, currentHPEdit: null,
        };
        this.renderer = new UIRenderer(this.gs, this);
    }

    init() {
        if (Object.keys(this.db._raw).length === 0) { this._announce('Error: Pokémon data file not found or empty.', true); return; }
        document.body.addEventListener('click', () => Tone.start(), { once: true });
        document.body.addEventListener('click', () => this.audio.init(), { once: true });
        this.db.buildIndex();
        this.log.linkGameState(this.gs);
        this._registerModals();
        this._prepopulate();
        this._populateMoveTypeSelector();
        this._setupEventListeners();
        this._setupKeyboardShortcuts();
        this._setupMultiplayerUI();
        this.renderer.renderAll();
        lucide.createIcons();
        this._setArena('Normal');
        this.history._updateButtons();
        this.log.add('Battle arena initialised. 6 trainers ready!', 'system');

        window.openTeamManager = id => this.openTeamManager(id);
        window.handleTeamIconClick = (pid, sid) => this.handleTeamIconClick(pid, sid);
        window.editHP = id => this.editHP(id);
        window.removePlayer = id => this.removePlayer(id);
    }

    _registerModals() {
        [['team', 'team-modal'], ['selection', 'selection-modal'], ['hpEdit', 'hp-edit-modal'],
         ['confirm', 'confirm-modal'], ['multiplayerLobby', 'multiplayer-lobby-modal']
        ].forEach(([name, id]) => this.modals.register(name, document.getElementById(id)));
    }

    _notify(message, logType = 'action', isError = false) {
        this.log.add(message, logType);
        this._announce(message, isError);
    }

    _applyHPChange(pokemon, playerId, newHP, source = '') {
        const clamped = Math.max(0, Math.min(pokemon.maxHp, newHP));
        const delta = clamped - pokemon.currentHP;
        pokemon.currentHP = clamped;
        if (delta === 0) { this.renderer.renderAll(); return; }
        const isHeal = delta > 0, isFaint = clamped === 0 && delta < 0;
        const label = source ? ` (${source})` : '';
        this._showDamageNumber(playerId, Math.abs(delta), isHeal ? 'heal' : 'damage');
        this._notify(`${pokemon.fullName}: ${isHeal ? '+' : ''}${delta} HP${label} (${clamped}/${pokemon.maxHp})`, isHeal ? 'heal' : 'damage');
        const animType = isFaint ? 'faint' : isHeal ? 'heal' : 'damage';
        if (isFaint) this.audio.playCry(pokemon);
        this._animateSprite(playerId, animType, () => this.renderer.renderAll());
    }

    addPlayer() {
        if (this.gs.players.length >= 6) { this._announce('Lobby Full: Maximum 6 trainers allowed.', true); return; }
        const input = document.getElementById('new-player-name');
        const name = input?.value.trim();
        if (!name) return;
        const player = new Player(Date.now(), name);
        this.gs.players.push(player);
        input.value = '';
        this.renderer.renderAll();
        this.openTeamManager(player.id);
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    removePlayer(playerId) {
        if (this.multiplayer?.mode !== 'offline' && !this.multiplayer.isHost) {
            this._notify('Only the host can remove players in multiplayer mode.', 'system', true); return;
        }
        const player = this.gs.players.find(p => p.id === playerId);
        if (!player) return;
        this.openConfirmModal('Remove Trainer', `Are you sure you want to remove ${player.name} from the battle?`, () => {
            this.history.snapshot(this.gs);
            this.gs.players = this.gs.players.filter(p => p.id !== playerId);
            ['activeTurnPlayerId', 'selectedAttackTargetId', 'selectedStatusTargetId'].forEach(key => {
                if (this.gs[key] === playerId) this.gs[key] = null;
            });
            this._notify(`${player.name} has been removed from the battle.`, 'system');
            this.renderer.renderAll();
            if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
        });
    }

    endRound() {
        this.history.snapshot(this.gs);
        this.gs.round++;
        this._applyWeatherDamage();
        this._applyStatusDamage();
        this.renderer.renderAll();
        this._notify(`========== ROUND ${this.gs.round} BEGINS ==========`, 'round');
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    handleAttack(attackType) {
        this.audio.play('attack');
        const attackerId = parseInt(document.getElementById('attacker-select')?.value);
        const targetId = parseInt(document.getElementById('attack-target-select')?.value);
        const moveType = document.getElementById('move-type-select')?.value;
        const powerInput = document.getElementById('move-power-input');
        let movePower = parseInt(powerInput?.value);

        if (movePower > 1000) { movePower = 1000; if (powerInput) powerInput.value = 1000; }
        if (movePower < 1) { movePower = 1; }

        if (!attackerId || !targetId || !moveType || isNaN(movePower)) {
            this._announce('Attacker, Target, Move Type, and Power are required!', true);
            this.audio.play('error');
            return;
        }

        const attackerPlayer = this.gs.players.find(p => p.id === attackerId);
        const targetPlayer = this.gs.players.find(p => p.id === targetId);
        if (!attackerPlayer || !targetPlayer) return;

        const attacker = attackerPlayer.getActivePokemon();
        const target = targetPlayer.getActivePokemon();

        if (attacker.isFainted()) { this._announce(`${attacker.fullName} is fainted and cannot attack!`, true); return; }
        if (target.isFainted()) { this._announce(`${target.fullName} is already fainted!`, true); return; }

        this.history.snapshot(this.gs);
        this.audio.playCry(attacker);

        const offStat = attackType === 'physical' ? attacker.getEffectiveStat('attack') : attacker.getEffectiveStat('specialAttack');
        const defStat = attackType === 'physical' ? target.getEffectiveStat('defence') : target.getEffectiveStat('specialDefence');
        const defenderTypes = target.types;

        const applyDamage = (damage, effectiveness) => {
            let msg = `${attacker.fullName} used a ${attackType} ${moveType} attack on ${target.fullName} for ${damage} damage!`;
            if (effectiveness > 1) {
                msg += " It's super effective!";
                this._showDamageNumber(targetId, 'Super Effective!', 'critical');
            }
            if (effectiveness < 1 && effectiveness > 0) msg += " It's not very effective...";
            if (effectiveness === 0) msg = `${target.fullName} is immune!`;

            this.log.add(msg, effectiveness === 0 ? 'action' : 'damage');
            this._announce(msg);

            if (damage > 0) this._showDamageNumber(targetId, `${damage} HP`, effectiveness >= 2 ? 'critical' : 'damage');

            target.currentHP = Math.max(0, target.currentHP - damage);

            const onDone = () => {
                if (target.isFainted()) {
                    this.audio.playCry(target);
                    this._announce(`${target.fullName} fainted!`);
                    this._animateSprite(targetId, 'faint', () => this.renderer.renderAll());
                } else {
                    this.renderer.renderAll();
                }
                if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
            };

            damage > 0 ? this._animateSprite(targetId, 'damage', onDone) : onDone();
        };

        if (this.multiplayer?.mode === 'playing' && this.multiplayer.socket) {
            this.multiplayer.socket.emit('game:calculate_damage', { offStat, defStat, defenderTypes, movePower, moveType }, (response) => {
                if (response && response.success) {
                    applyDamage(response.damage, response.effectiveness);
                } else {
                    this._announce('Server damage calculation failed.', true);
                    this.renderer.renderAll();
                }
            });
        } else {
            const res = this.engine.calculateDamage(attacker, target, movePower, moveType, attackType);
            applyDamage(res.damage, res.effectiveness);
        }
    }

    updateAttackPreview() {
        const moveType = document.getElementById('move-type-select')?.value;
        const targetId = parseInt(document.getElementById('attack-target-select')?.value);
        const display = document.getElementById('type-effectiveness-display');
        if (!display) return;
        if (!moveType || !targetId) { display.textContent = '--'; return; }
        const pokemon = this.gs.players.find(p => p.id === targetId)?.getActivePokemon();
        if (!pokemon) { display.textContent = '--'; return; }

        const mult = this.engine.getTypeEffectiveness(moveType, pokemon.types);
        let label = `x${mult}`;
        if (mult >= 2) label += ' (Super effective!)';
        if (mult < 1 && mult > 0) label += ' (Not very effective...)';
        if (mult === 0) label += ' (No effect!)';
        display.textContent = label;
    }

    toggleStatus(event) {
        this.audio.play('status');
        const status = event.target.closest('button')?.dataset.status;
        const targetId = parseInt(document.getElementById('status-target-select')?.value);
        if (!status || !targetId) return;

        const pokemon = this.gs.players.find(p => p.id === targetId)?.getActivePokemon();
        if (!pokemon) return;

        this.history.snapshot(this.gs);
        if (pokemon.hasStatus(status)) {
            pokemon.removeStatus(status);
            this._notify(`${pokemon.fullName}'s ${status} was cured.`, 'status');
        } else {
            pokemon.applyStatus(status);
            this._notify(`${pokemon.fullName} was afflicted with ${status}.`, 'status');
        }
        this.renderer.renderAll();
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    handleStatUpdate() {
        const targetId = parseInt(document.getElementById('status-target-select')?.value);
        const statName = document.getElementById('stat-select')?.value;
        const value = parseInt(document.getElementById('stat-value-input')?.value);
        const modType = document.getElementById('stat-mod-type')?.value;

        if (!targetId || !statName || isNaN(value)) { this._announce('Please select a target, stat, and value.', true); return; }
        const pokemon = this.gs.players.find(p => p.id === targetId)?.getActivePokemon();
        if (!pokemon) return;

        this.history.snapshot(this.gs);
        if (statName === 'hp') {
            const currentModded = applyModification(pokemon.currentHP, pokemon.maxHp, modType, value, pokemon.maxHp);
            this._applyHPChange(pokemon, targetId, currentModded, 'stat update');
        } else {
            const change = pokemon.modifyStat(statName, modType, value);
            const final = pokemon.getEffectiveStat(statName);
            if (change > 0) {
                this._notify(`${pokemon.fullName}'s ${statName.toUpperCase()} rose! (→ ${final})`, 'heal');
                this._animateSprite(targetId, 'heal', () => this.renderer.renderAll());
            } else if (change < 0) {
                this._notify(`${pokemon.fullName}'s ${statName.toUpperCase()} fell! (→ ${final})`, 'damage');
                this._animateSprite(targetId, 'damage', () => this.renderer.renderAll());
            } else {
                this.renderer.renderAll();
            }
        }
        this.audio.play('confirm');
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }
    editHP(playerId) {
        const player = this.gs.players.find(p => p.id === playerId);
        if (!player) return;
        const active = player.getActivePokemon();
        if (!active) { this._announce('No active Pokémon to edit HP.', true); return; }
        this.gs.currentHPEdit = { playerId, pokemonId: active.id };
        const modal = document.getElementById('hp-edit-modal');
        const currentPlayerNameIdStr = String(playerId);
        document.getElementById('hp-edit-title').textContent = `Edit HP: ${player.name}'s ${active.fullName}`;
        document.getElementById('hp-current-display').textContent = `${active.currentHP} / ${active.maxHp}`;
        document.getElementById('hp-new-value').value = active.currentHP;
        document.getElementById('hp-new-value').max = active.maxHp;
        const setHP = val => document.getElementById('hp-new-value').value = Math.max(0, Math.min(active.maxHp, val));
        document.querySelectorAll('.hp-quick-btn').forEach(btn => {
            btn.onclick = () => { const pct = parseInt(btn.dataset.percent); setHP(Math.round((pct / 100) * active.maxHp)); };
        });
        document.querySelectorAll('.hp-adjust-btn').forEach(btn => {
            btn.onclick = () => { const change = parseInt(btn.dataset.change); const cur = parseInt(document.getElementById('hp-new-value').value) || 0; setHP(cur + change); };
        });
        document.getElementById('confirm-hp-edit').onclick = () => this.confirmHPEdit();
        document.getElementById('cancel-hp-edit').onclick = () => this.modals.close('hpEdit');
        document.getElementById('close-hp-edit-modal').onclick = () => this.modals.close('hpEdit');
        this.modals.open('hpEdit');
    }

    confirmHPEdit() {
        if (!this.gs.currentHPEdit) return;
        const { playerId, pokemonId } = this.gs.currentHPEdit;
        const player = this.gs.players.find(p => p.id === playerId);
        const newHPVal = parseInt(document.getElementById('hp-new-value').value);
        if (!player || isNaN(newHPVal)) { this.modals.close('hpEdit'); return; }
        const pokemon = player.team.find(p => p.id === pokemonId);
        if (!pokemon) { this.modals.close('hpEdit'); return; }
        this.history.snapshot(this.gs);
        this._applyHPChange(pokemon, playerId, newHPVal, 'manual edit');
        this.gs.currentHPEdit = null;
        this.modals.close('hpEdit');
        this.audio.play('save');
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    openTeamManager(playerId) {
        if (this.multiplayer?.mode === 'playing') {
            if (this.multiplayer.isHost) { } else if (this.multiplayer.assignedPlayerId && this.multiplayer.assignedPlayerId !== playerId) {
                this._notify('You can only manage your own team in multiplayer mode.', 'system', true); return;
            }
        }
        const player = this.gs.players.find(p => p.id === playerId);
        if (!player) return;
        this.gs.currentEditing.playerId = playerId;
        document.getElementById('team-modal-title').textContent = `Manage Team: ${player.name}`;
        this._renderTeamEditorGrid();
        document.getElementById('pokemon-editor-form').classList.add('hidden');
        document.getElementById('confirm-team-btn').onclick = () => {
            this.modals.close('team'); this.renderer.renderAll();
            if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
        };
        document.getElementById('close-team-modal').onclick = () => this.modals.close('team');
        this.modals.open('team');
    }

    _renderTeamEditorGrid() {
        const grid = document.getElementById('team-editor-grid');
        grid.innerHTML = '';
        const player = this.gs.players.find(p => p.id === this.gs.currentEditing.playerId);
        for (let i = 0; i < 6; i++) {
            const slot = document.createElement('div');
            slot.className = 'bg-slate-700 border-2 border-slate-500 rounded p-2 text-center cursor-pointer hover:bg-slate-600 transition-colors h-24 flex flex-col justify-center items-center relative';
            const mon = player.team[i];
            if (mon) {
                slot.innerHTML = `<img src="${mon.spriteUrl}" alt="${mon.name}" class="h-12 w-12 object-contain filter drop-shadow-md pixelated"><div class="text-xs text-white font-bold mt-1 max-w-full overflow-hidden text-ellipsis px-1">${mon.fullName}</div><div class="text-[0.6rem] text-slate-300">Lv ${mon.level}</div>`;
                const removeBtn = document.createElement('button');
                removeBtn.className = 'absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white w-5 h-5 flex items-center justify-center text-xs;';
                removeBtn.innerHTML = '×';
                removeBtn.onclick = (e) => { e.stopPropagation(); this._removePokemonSlot(i); };
                slot.appendChild(removeBtn);
            } else {
                slot.innerHTML = `<div class="text-slate-400 text-2xl font-bold">+</div><div class="text-[0.6rem] text-slate-400 mt-1 uppercase">Empty Slot</div>`;
            }
            slot.onclick = () => this._openPokemonEditor(i);
            grid.appendChild(slot);
        }
    }

    _openPokemonEditor(slotIndex) {
        this.gs.currentEditing.slotId = slotIndex;
        const player = this.gs.players.find(p => p.id === this.gs.currentEditing.playerId);
        const existingMon = player.team[slotIndex];
        const form = document.getElementById('pokemon-editor-form');
        form.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm text-slate-300 mb-1">Pokémon</label>
                    <select id="edit-pokemon-select" class="w-full bg-slate-700 border border-slate-500 p-2 text-sm text-white focus:outline-none focus:border-yellow-400">
                        <option value="">-- Select Pokémon --</option></select>
                </div>
                <div><label class="block text-sm text-slate-300 mb-1">Level</label><input type="number" id="edit-level" class="w-full bg-slate-700 border border-slate-500 p-2 text-sm text-white input-no-spinner focus:outline-none focus:border-yellow-400" min="1" max="100" value="${existingMon ? existingMon.level : 100}"></div>
                <div><label class="block text-sm text-slate-300 mt-2 mb-1">Ability</label><select id="edit-ability-select" class="w-full bg-slate-700 border border-slate-500 p-2 text-sm text-white focus:outline-none focus:border-yellow-400"><option value="">-- Base form default --</option></select></div>
            </div>
            <div class="mt-4 flex gap-2 justify-end">
                <button id="cancel-edit-btn" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 border border-black text-sm">Cancel</button>
                <button id="save-edit-btn" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 border border-black font-bold text-sm">Save to Slot</button>
            </div>`;
        
        const select = document.getElementById('edit-pokemon-select');
        const abilitySelect = document.getElementById('edit-ability-select');
        
        const sortedNames = [...this.db.filteredNames].sort((a,b) => a.localeCompare(b));
        const frag = document.createDocumentFragment();
        sortedNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            frag.appendChild(opt);
        });
        select.appendChild(frag);

        if (existingMon) {
            select.value = existingMon.name;
            abilitySelect.innerHTML = this._buildAbilityOptionsHTML(existingMon.name, existingMon.ability);
            setTimeout(() => { select.dataset.baseValue = select.value; }, 50);
        }

        select.addEventListener('change', (e) => { abilitySelect.innerHTML = this._buildAbilityOptionsHTML(e.target.value); });
        
        document.getElementById('cancel-edit-btn').onclick = () => form.classList.add('hidden');
        document.getElementById('save-edit-btn').onclick = () => this._confirmPokemonEdit();
        form.classList.remove('hidden');
    }

    _buildAbilityOptionsHTML(pokemonName, selectedAbility = null) {
        if (!pokemonName) return '<option value="">-- Select Pokémon first --</option>';
        const result = this.db.find(pokemonName);
        const data = result ? result.foundNode : null;
        if (!data || !data.abilities) return '<option value="">Unknown</option>';
        
        let html = '';
        Object.entries(data.abilities).forEach(([key, abilityName]) => {
            const isSelected = selectedAbility === abilityName ? 'selected' : '';
            if (key === '0') html += `<option value="${abilityName}" ${isSelected}>${abilityName}</option>`;
            else if (key === '1') html += `<option value="${abilityName}" ${isSelected}>${abilityName}</option>`;
            else if (key === 'H') html += `<option value="${abilityName}" ${isSelected}>${abilityName} (Hidden)</option>`;
        });
        return html;
    }

    _confirmPokemonEdit() {
        const select = document.getElementById('edit-pokemon-select');
        let pokemonName = select.value;
        
        const level = parseInt(document.getElementById('edit-level').value) || 100;
        const selectedAbility = document.getElementById('edit-ability-select').value;
        if (!pokemonName) { this._announce('Please select a Pokémon', true); return; }

        this.history.snapshot(this.gs);
        const player = this.gs.players.find(p => p.id === this.gs.currentEditing.playerId);
        const newMon = this.db.createPokemonInstance(pokemonName, level);
        if (!newMon) { this._announce(`Failed to create ${pokemonName}`, true); return; }
        
        if (selectedAbility) newMon.ability = selectedAbility;

        player.team[this.gs.currentEditing.slotId] = newMon;
        if (player.activePokemonIndex === null) player.activePokemonIndex = this.gs.currentEditing.slotId;
        
        document.getElementById('pokemon-editor-form').classList.add('hidden');
        this._renderTeamEditorGrid();
        this.audio.play('save');
    }

    _removePokemonSlot(slotIndex) {
        const player = this.gs.players.find(p => p.id === this.gs.currentEditing.playerId);
        this.history.snapshot(this.gs);
        player.team[slotIndex] = null;
        if (player.activePokemonIndex === slotIndex) {
            const nextIdx = player.team.findIndex(p => p !== null);
            player.activePokemonIndex = nextIdx !== -1 ? nextIdx : null;
        }
        this._renderTeamEditorGrid();
    }

    handleTeamIconClick(playerId, slotIndex) {
        const player = this.gs.players.find(p => p.id === playerId);
        if (!player) return;
        if (this.multiplayer?.mode === 'playing') {
            if (this.multiplayer.isHost) { } else if (this.multiplayer.assignedPlayerId && this.multiplayer.assignedPlayerId !== playerId) {
                this._notify('You cannot switch another trainer\'s active Pokémon.', 'system', true); return;
            }
        }
        if (player.activePokemonIndex === slotIndex) { this.openTeamManager(playerId); return; }
        const mon = player.team[slotIndex];
        if (!mon) { this.openTeamManager(playerId); return; }
        if (mon.isFainted()) { this._announce(`${mon.fullName} is fainted and cannot battle!`, true); this.audio.play('error'); return; }
        this.history.snapshot(this.gs);
        this._switchActivePokemon(playerId, slotIndex);
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    _switchActivePokemon(playerId, slotIndex) {
        const player = this.gs.players.find(p => p.id === playerId);
        player.activePokemonIndex = slotIndex;
        const newActive = player.getActivePokemon();
        this._notify(`${player.name} sent out ${newActive.fullName}!`, 'system');
        this.audio.playCry(newActive);
        this.gs.activeTurnPlayerId = playerId;
        this.renderer.renderAll();
        this._playEntryAnimation(playerId);
        this.updateAttackPreview();
    }

    openConfirmModal(title, message, onConfirm) {
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        document.getElementById('confirm-modal-yes').onclick = () => { onConfirm(); this.modals.close('confirm'); };
        document.getElementById('confirm-modal-no').onclick = () => this.modals.close('confirm');
        document.getElementById('close-confirm-modal').onclick = () => this.modals.close('confirm');
        this.modals.open('confirm');
    }

    handleEvolve() {
        const playerId = parseInt(document.getElementById('management-pokemon-select')?.value);
        if (!playerId) return;
        const player = this.gs.players.find(p => p.id === playerId);
        const pokemon = player?.getActivePokemon();
        if (!pokemon) return;

        const evos = this.db.getEvolutions(pokemon.name);
        if (!evos || evos.length === 0) { this._announce(`${pokemon.name} cannot evolve further.`, true); return; }
        
        if (evos.length === 1) {
            this.openConfirmModal('Evolve', `Evolve ${pokemon.name} into ${evos[0]}?`, () => this._confirmEvolution(playerId, pokemon, evos[0]));
        } else {
            this._openEvolutionChoiceModal(playerId, pokemon, evos);
        }
    }

    _openEvolutionChoiceModal(playerId, pokemon, evos) {
        document.getElementById('selection-modal-title').textContent = `Evolve ${pokemon.name}`;
        const grid = document.getElementById('selection-grid');
        grid.innerHTML = '';
        evos.forEach(evoName => {
            const data = this.db.getPokemon(evoName);
            if (!data) return;
            const btn = document.createElement('div');
            btn.className = 'bg-slate-700 hover:bg-slate-600 border-2 border-slate-500 rounded p-2 text-center cursor-pointer transition-colors';
            btn.innerHTML = `<img src="https://play.pokemonshowdown.com/sprites/gen5/${evoName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png" class="mx-auto h-16 w-16 object-contain" onerror="this.src='https://play.pokemonshowdown.com/sprites/gen5/substitute.png'"><div class="text-xs text-white font-bold mt-2">${evoName}</div>`;
            btn.onclick = () => { this.modals.close('selection'); this._confirmEvolution(playerId, pokemon, evoName); };
            grid.appendChild(btn);
        });
        document.getElementById('close-selection-modal').onclick = () => this.modals.close('selection');
        this.modals.open('selection');
    }

    _confirmEvolution(playerId, oldPokemon, newSpeciesName) {
        this.history.snapshot(this.gs);
        if (oldPokemon.evolve(newSpeciesName, this.db)) {
            this.audio.play('evolve');
            this._notify(`What? ${oldPokemon.name} is evolving!`, 'system');
            setTimeout(() => {
                this.audio.playCry(oldPokemon);
                this._notify(`Congratulations! It evolved into ${newSpeciesName}!`, 'system');
                this.renderer.renderAll();
                this._playEntryAnimation(playerId);
                if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
            }, 1000);
        } else {
            this._announce('Evolution failed.', true);
        }
    }

    openFormChangeModal() {
        const playerId = parseInt(document.getElementById('management-pokemon-select')?.value);
        if (!playerId) return;
        const player = this.gs.players.find(p => p.id === playerId);
        const pokemon = player?.getActivePokemon();
        if (!pokemon) return;

        const forms = this.db.getForms(pokemon.baseSpecies);
        if (!forms || forms.length === 0) { this._announce(`${pokemon.name} has no alternate forms.`, true); return; }

        document.getElementById('selection-modal-title').textContent = `Change Form: ${pokemon.name}`;
        const grid = document.getElementById('selection-grid');
        grid.innerHTML = '';
        
        if (pokemon.name !== pokemon.baseSpecies) {
            this._populateSelectionGrid(grid, pokemon.baseSpecies, () => this._confirmFormChange(playerId, pokemon, pokemon.baseSpecies));
        }
        
        forms.forEach(form => {
            if (form !== pokemon.name) {
                this._populateSelectionGrid(grid, form, () => this._confirmFormChange(playerId, pokemon, form));
            }
        });
        
        document.getElementById('close-selection-modal').onclick = () => this.modals.close('selection');
        this.modals.open('selection');
    }

    _confirmFormChange(playerId, oldPokemon, newFormName) {
        this.history.snapshot(this.gs);
        if (oldPokemon.changeForm(newFormName, this.db)) {
            this.audio.play('stat');
            this._notify(`${oldPokemon.baseSpecies} changed its form into ${newFormName}!`, 'system');
            this.audio.playCry(oldPokemon);
            this.renderer.renderAll();
            this._playEntryAnimation(playerId);
            if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
        } else {
            this._announce('Form change failed.', true);
        }
    }

    _populateSelectionGrid(grid, name, onClick) {
        const data = this.db.getPokemon(name);
        if (!data) return;
        const btn = document.createElement('div');
        btn.className = 'bg-slate-700 hover:bg-slate-600 border-2 border-slate-500 rounded p-2 text-center cursor-pointer transition-colors';
        btn.innerHTML = `<img src="https://play.pokemonshowdown.com/sprites/gen5/${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png" class="mx-auto h-16 w-16 object-contain" onerror="this.src='https://play.pokemonshowdown.com/sprites/gen5/substitute.png'"><div class="text-xs text-white font-bold mt-2">${name}</div>`;
        btn.onclick = () => { this.modals.close('selection'); onClick(); };
        grid.appendChild(btn);
    }

    handleRevive() {
        const playerId = parseInt(document.getElementById('management-pokemon-select')?.value);
        if (!playerId) return;
        const player = this.gs.players.find(p => p.id === playerId);
        const pokemon = player?.getActivePokemon();
        if (!pokemon) return;
        if (!pokemon.isFainted()) { this._announce(`${pokemon.fullName} is not fainted!`, true); return; }
        this.history.snapshot(this.gs);
        this.audio.play('heal');
        const reviveHP = Math.floor(pokemon.maxHp / 2) || 1;
        this._notify(`${player.name} used a Revive!`, 'system');
        this._applyHPChange(pokemon, playerId, reviveHP, 'revived');
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    cycleWeather() {
        const weathers = ['none', 'sandstorm', 'hail', 'rain', 'sun'];
        const currentIdx = weathers.indexOf(this.gs.weather);
        this.gs.weather = weathers[(currentIdx + 1) % weathers.length];
        this._setArena(this.gs.weather);
        this._notify(`Weather changed to ${this.gs.weather.toUpperCase()}`, 'system');
        if (this.multiplayer?.mode === 'playing') this.multiplayer.sendGameState();
    }

    _applyStatusDamage() {
        this.gs.players.forEach(p => {
            const active = p.getActivePokemon();
            if (!active || active.isFainted()) return;
            if (active.hasStatus('poison')) {
                this.audio.play('status');
                const dmg = Math.max(1, Math.floor(active.maxHp / 8));
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'poison');
            } else if (active.hasStatus('bad_poison')) {
                this.audio.play('status');
                const dmg = Math.max(1, Math.floor(active.maxHp * active.toxicCounter / 16));
                active.toxicCounter++;
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'toxic');
            }
            if (active.hasStatus('burn')) {
                this.audio.play('burn');
                const dmg = Math.max(1, Math.floor(active.maxHp / 8));
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'burn');
            }
            if (active.hasStatus('curse')) {
                this.audio.play('curse');
                const dmg = Math.max(1, Math.floor(active.maxHp / 4));
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'curse');
            }
        });
    }

    _applyWeatherDamage() {
        if (this.gs.weather === 'none') return;
        this.gs.players.forEach(p => {
            const active = p.getActivePokemon();
            if (!active || active.isFainted()) return;
            if (this.gs.weather === 'sandstorm' && !active.types.some(t => ['Rock', 'Ground', 'Steel'].includes(t))) {
                const dmg = Math.max(1, Math.floor(active.maxHp / 16));
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'sandstorm');
            } else if (this.gs.weather === 'hail' && !active.types.includes('Ice')) {
                const dmg = Math.max(1, Math.floor(active.maxHp / 16));
                this._applyHPChange(active, p.id, active.currentHP - dmg, 'hail');
            }
        });
    }

    _setArena(weather) {
        let bgUrl = '';
        if (['sun', 'rain'].includes(weather)) bgUrl = arenaBackgrounds['Water'];
        else if (weather === 'sandstorm') bgUrl = arenaBackgrounds['Rock'];
        else if (weather === 'hail') bgUrl = arenaBackgrounds['Ice'];
        else bgUrl = arenaBackgrounds['Normal'];

        document.getElementById('parallax-bg').style.backgroundImage = `url('${bgUrl}')`;
        document.getElementById('sandstorm-overlay')?.classList.toggle('hidden', weather !== 'sandstorm');
        document.getElementById('hail-overlay')?.classList.toggle('hidden', weather !== 'hail');
    }

    _animateSprite(playerId, type, callback) {
        if (!this.renderer.settings.animationSpeed) return callback();
        const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
        if (!card) return callback();
        const sprite = card.querySelector('.pokemon-sprite');
        if (!sprite) return callback();
        const durationStr = this.renderer.settings.animationSpeed;
        const baseMs = type === 'damage' ? 300 : type === 'faint' ? 800 : type === 'heal' ? 600 : 500;
        const dur = isNaN(parseFloat(durationStr)) ? baseMs : baseMs / parseFloat(durationStr);

        sprite.classList.remove('anim-damage', 'anim-faint', 'anim-heal', 'anim-entry');
        
        requestAnimationFrame(() => {
            sprite.classList.add(`anim-${type}`);
            if (type === 'faint') { sprite.style.opacity = '0'; sprite.style.transform = 'translateY(20px)'; }
            setTimeout(() => {
                sprite.classList.remove(`anim-${type}`);
                if (callback) callback();
            }, dur);
        });
    }

    _playEntryAnimation(playerId) {
        const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
        if (!card) return;
        const sprite = card.querySelector('.pokemon-sprite');
        if (sprite) {
            sprite.style.opacity = '0';
            requestAnimationFrame(() => {
                sprite.style.transition = 'opacity 0.5s ease-in, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                sprite.style.opacity = '1';
                sprite.classList.add('anim-entry');
                setTimeout(() => sprite.classList.remove('anim-entry'), 500);
            });
        }
    }

    _showDamageNumber(playerId, amount, type = 'damage') {
        const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
        if (!card || !this.renderer.settings.damageNumbers) return;
        
        const rect = card.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = `fixed font-pixel text-xl font-bold pointer-events-none z-50 floating-damage ${type}`;
        
        const colors = { damage: '#ff4444', heal: '#44ff44', critical: '#ffaa00' };
        el.style.color = colors[type];
        el.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';
        el.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
        el.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`;
        el.style.top = `${rect.top + rect.height / 2 + (Math.random() * 20 - 10)}px`;

        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = `translateY(-50px) scale(${type==='critical'?1.5:1})`;
            el.style.opacity = '0';
            el.style.transition = 'all 1s cubic-bezier(0.25, 0.8, 0.25, 1)';
        });
        setTimeout(() => el.remove(), 1000);
    }

    _announce(message, isError = false) {
        const banner = document.getElementById('announcement-banner');
        const text = document.getElementById('announcement-text');
        if (!banner || !text) return;
        text.textContent = message;
        banner.className = `fixed top-4 left-1/2 transform -translate-x-1/2 border-2 px-6 py-3 z-50 text-white font-bold transition-all ${isError ? 'bg-red-800 border-red-400' : 'bg-slate-800 border-yellow-400'}`;
        banner.classList.remove('hidden');
        banner.style.animation = 'none';
        void banner.offsetWidth; // reflow
        banner.style.animation = 'slideDown 0.3s ease-out forwards';
        
        if (this._announceTimeout) clearTimeout(this._announceTimeout);
        this._announceTimeout = setTimeout(() => {
            banner.style.animation = 'slideUp 0.3s ease-in forwards';
            setTimeout(() => banner.classList.add('hidden'), 300);
        }, 3000);
    }

    _prepopulate() {
        const teams = [
            { name: 'Ash', mons: ['Pikachu', 'Charizard', 'Snorlax', 'Bulbasaur', 'Squirtle', 'Butterfree'] },
            { name: 'Gary', mons: ['Blastoise', 'Umbreon', 'Arcanine', 'Nidoking', 'Scizor', 'Alakazam'] },
            { name: 'Misty', mons: ['Starmie', 'Gyarados', 'Psyduck', 'Togepi', 'Corsola', 'Lapras'] },
            { name: 'Brock', mons: ['Onix', 'Geodude', 'Vulpix', 'Crobat', 'Sudowoodo', 'Steelix'] },
            { name: 'Cynthia', mons: ['Garchomp', 'Lucario', 'Milotic', 'Togekiss', 'Spiritomb', 'Roserade'] },
            { name: 'Steven', mons: ['Metagross', 'Aggron', 'Skarmory', 'Claydol', 'Cradily', 'Armaldo'] }
        ];

        teams.forEach((t, i) => {
            const player = new Player(Date.now() + i, t.name);
            t.mons.forEach((mon, j) => {
                player.team[j] = this.db.createPokemonInstance(mon);
            });
            player.activePokemonIndex = 0;
            this.gs.players.push(player);
        });
    }

    _populateMoveTypeSelector() {
        const select = document.getElementById('move-type-select');
        if (!select) return;
        select.innerHTML = '<option value="">Type</option>' + Object.keys(typeChart).sort().map(t => `<option value="${t}">${t}</option>`).join('');
    }

    // Now uses the window.MovesData to auto-fill power/type
    _populateMoveSelector() {
        const moveSelect = document.getElementById('move-name-select');
        if (!moveSelect || !window.MovesData) return;
        
        moveSelect.innerHTML = '<option value="">-- Select Move --</option>';
        const sortedMoves = Object.values(window.MovesData).sort((a,b) => a.name.localeCompare(b.name));
        
        const frag = document.createDocumentFragment();
        sortedMoves.forEach(m => {
            const bp = m.basePower || '--';
            const option = document.createElement('option');
            option.value = m.name;
            option.dataset.type = m.type;
            option.dataset.power = m.basePower || '';
            option.textContent = `${m.name} (${m.type}, ${bp})`;
            frag.appendChild(option);
        });
        moveSelect.appendChild(frag);
        
        moveSelect.addEventListener('change', (e) => {
            const selectedOpt = moveSelect.options[moveSelect.selectedIndex];
            if (!selectedOpt.value) return;

            const type = selectedOpt.dataset.type;
            const power = selectedOpt.dataset.power;
            
            let category = null;
            if (window.MovesData) {
                const moveData = Object.values(window.MovesData).find(x => x.name === selectedOpt.value);
                if (moveData) category = moveData.category; // "Physical", "Special", or "Status"
            }

            const typeSelect = document.getElementById('move-type-select');
            if (type && typeSelect) {
                typeSelect.value = type;
                typeSelect.dispatchEvent(new Event('change'));
            }
            
            const powerInput = document.getElementById('move-power-input');
            if (powerInput) {
                if (power && power !== '--') powerInput.value = power;
                else powerInput.value = '';
            }
            
            if (category) {
                if (category === 'Physical') { this.handleAttack('physical'); }
                else if (category === 'Special') { this.handleAttack('special'); }
                else { this._announce(`${selectedOpt.value} is a Status move. Implementing effects is manual.`, false); }
            }
            
            // Reset selector so the same move can be clicked again
            moveSelect.value = '';
        });
    }

    _populateAbilitiesMap() { }

    _toggleLoading(show) { document.getElementById('loading-overlay')?.classList.toggle('hidden', !show); }

    _setupEventListeners() {
        this._populateMoveSelector();

        // End round
        document.getElementById('end-round-btn')?.addEventListener('click', () => { this.audio.play('click'); this.endRound(); });
        
        // Attack commands
        document.getElementById('physical-attack-btn')?.addEventListener('click', () => this.handleAttack('Physical'));
        document.getElementById('special-attack-btn')?.addEventListener('click', () => this.handleAttack('Special'));
        
        const attachAudio = (id, type='click') => document.getElementById(id)?.addEventListener('click', () => this.audio.play(type));
        attachAudio('physical-attack-btn', 'attack'); attachAudio('special-attack-btn', 'attack');
        
        // Utility
        document.getElementById('generate-number-btn')?.addEventListener('click', () => {
            this.audio.play('click');
            const num = Math.floor(Math.random() * 100) + 1;
            document.getElementById('random-number-display').textContent = num;
            this._notify(`RNG Rolled: ${num}`, 'system');
        });
        document.getElementById('add-player-btn')?.addEventListener('click', () => { this.audio.play('click'); this.addPlayer(); });
        
        // Target changes
        ['move-type-select', 'attack-target-select'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updateAttackPreview());
        });

        // Status
        document.querySelectorAll('.status-btn').forEach(btn => btn.addEventListener('click', e => this.toggleStatus(e)));
        document.getElementById('update-stat-btn')?.addEventListener('click', () => this.handleStatUpdate());
        document.getElementById('weather-btn')?.addEventListener('click', () => { this.audio.play('click'); this.cycleWeather(); });
        
        // Management
        document.getElementById('evolve-btn')?.addEventListener('click', () => { this.audio.play('click'); this.handleEvolve(); });
        document.getElementById('change-form-btn')?.addEventListener('click', () => { this.audio.play('click'); this.openFormChangeModal(); });
        document.getElementById('revive-btn')?.addEventListener('click', () => { this.handleRevive(); });

        // Timer
        document.getElementById('timer-start')?.addEventListener('click', () => { this.audio.play('click'); this.timer.start(() => this.audio.play('timer')); });
        document.getElementById('timer-pause')?.addEventListener('click', () => { this.audio.play('click'); this.timer.pause(); });
        document.getElementById('timer-reset')?.addEventListener('click', () => { this.audio.play('click'); this.timer.reset(); });

        // History
        const updateHistBtns = () => setTimeout(() => this.history._updateButtons(), 50);
        document.getElementById('undo-btn')?.addEventListener('click', () => { this.audio.play('cancel'); this.gs = this.history.undo(this.gs); this.renderer.gs = this.gs; this.renderer.renderAll(); updateHistBtns(); if(this.multiplayer?.mode==='playing') this.multiplayer.sendGameState(); });
        document.getElementById('redo-btn')?.addEventListener('click', () => { this.audio.play('click'); this.gs = this.history.redo(this.gs); this.renderer.gs = this.gs; this.renderer.renderAll(); updateHistBtns(); if(this.multiplayer?.mode==='playing') this.multiplayer.sendGameState(); });
    }

    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey) {
                if (e.key === 'z') { e.preventDefault(); e.shiftKey ? document.getElementById('redo-btn')?.click() : document.getElementById('undo-btn')?.click(); }
                return;
            }
            if (e.key >= '1' && e.key <= '6') {
                const idx = parseInt(e.key) - 1;
                if (this.gs.players[idx]) this.openTeamManager(this.gs.players[idx].id);
            }
            switch (e.key.toLowerCase()) {
                case ' ': e.preventDefault(); document.getElementById('end-round-btn')?.click(); break;
                case 'p': document.getElementById('physical-attack-btn')?.click(); break;
                case 's': document.getElementById('special-attack-btn')?.click(); break;
                case 'e': document.getElementById('evolve-btn')?.click(); break;
                case 'f': document.getElementById('change-form-btn')?.click(); break;
                case 'r': document.getElementById('generate-number-btn')?.click(); break;
                case 'escape': 
                    Object.keys(this.modals.modals).forEach(m => this.modals.close(m));
                    document.getElementById('pokemon-editor-form')?.classList.add('hidden');
                    break;
            }
        });
    }

    _setupMultiplayerUI() {
        this.multiplayer.onJoinRequest = (playerName, callback) => {
            if (confirm(`Accept ${playerName} into the room?`)) callback('accept'); else callback('reject');
        };
        this.multiplayer.onRoomUpdate = (data) => this.multiplayer.updateRoomUI(data);
        this.multiplayer.onGameStart = () => {
             this.modals.close('multiplayerLobby');
             document.getElementById('lobby-view')?.classList.add('hidden');
             document.getElementById('arena-view')?.classList.remove('hidden');
             this.audio.play('battle_start');
             this._notify('Multiplayer battle has begun!', 'system');
        };
        this.multiplayer.onGameState = (state) => {
             this.history.snapshot(this.gs);
             this.multiplayer.deserializeGameState(state);
             this.renderer.renderAll();
        };
        this.multiplayer.onChat = (data) => this.multiplayer.displayChatMessage(data);
        this.multiplayer.onNotification = (msg, type) => this.multiplayer.showNotification(msg, type);

        window.createMultiplayerRoom = () => {
            const name = prompt('Enter your trainer name (Host):');
            if (name) { this.multiplayer.connect(); setTimeout(() => this.multiplayer.createRoom(name), 500); }
        };

        window.joinMultiplayerRoom = () => {
            const code = prompt('Enter the 6-digit room code:');
            const name = prompt('Enter your trainer name:');
            if (code && name) { this.multiplayer.connect(); setTimeout(() => this.multiplayer.joinRoom(code.toUpperCase(), name), 500); }
        };
    }
}


