export const LOBBY_ARMY_SIZES = Object.freeze([250, 500, 1000, 2000]);

export function validatePregameCheckpoint(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['phase', 'revision'].includes(key))
    || !['lobby', 'running'].includes(value.phase)
    || !Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new TypeError('Invalid pregame checkpoint.');
  }
  return { phase: value.phase, revision: value.revision };
}

/** Uses the worker's existing seat sessions; never allocates identities or seats. */
export class RoomPregame {
  constructor(mapId, armySize, checkpoint = { phase: 'lobby', revision: 0 }) {
    const saved = validatePregameCheckpoint(checkpoint);
    if (!saved) throw new TypeError('Pregame phase is required.');
    this.phase = saved.phase;
    this.revision = saved.revision;
    this.mapId = mapId;
    this.armySize = armySize;
    this.seats = [];
    this.readyIds = new Set();
  }

  invalidate() {
    this.revision++;
    this.readyIds.clear();
  }

  syncSeats(seats) {
    const next = seats.map(({ id, team, connected }) => ({ id, team, connected }))
      .sort((a, b) => a.team - b.team);
    if (JSON.stringify(next) === JSON.stringify(this.seats)) return false;
    this.seats = next;
    if (this.phase === 'lobby') this.invalidate();
    return true;
  }

  requireSeat(player, host = false) {
    if (!this.seats.some(seat => seat.id === player.id && seat.team === player.team && seat.connected)) {
      throw new Error('Only a connected player seat can use lobby controls.');
    }
    if (host && player.team !== 0) throw new Error('Only the Azure host can change settings or launch.');
  }

  requireRevision(revision) {
    if (!Number.isSafeInteger(revision) || revision !== this.revision) {
      throw new Error('Lobby changed. Review the settings and ready again.');
    }
  }

  configure(player, command, mapCatalog) {
    this.requireSeat(player, true);
    this.requireRevision(command.revision);
    if (this.phase !== 'lobby') throw new Error('Reset the match to return to the lobby.');
    if (Object.keys(command).some(key => !['type', 'revision', 'mapId', 'armySize'].includes(key))) {
      throw new Error('Unknown lobby setting.');
    }
    const mapId = command.mapId ?? this.mapId;
    const map = typeof mapId === 'string' ? mapCatalog.get(mapId) : null;
    if (!map) throw new Error('Choose a map from this room’s catalog.');
    const mapChanged = mapId !== this.mapId;
    const armySize = command.armySize ?? (mapChanged ? map.startingArmySize ?? 1000 : this.armySize);
    if (Object.hasOwn(command, 'armySize') && !LOBBY_ARMY_SIZES.includes(command.armySize)) {
      throw new Error('Choose 250, 500, 1000 or 2000 total starting units.');
    }
    if (Object.hasOwn(command, 'mapId') && typeof command.mapId !== 'string') {
      throw new Error('Choose a map from this room’s catalog.');
    }
    if (mapId === this.mapId && armySize === this.armySize) return false;
    this.mapId = mapId;
    this.armySize = armySize;
    this.invalidate();
    return true;
  }

  setReady(player, command) {
    this.requireSeat(player);
    this.requireRevision(command.revision);
    if (this.phase !== 'lobby') throw new Error('The match has already launched.');
    if (typeof command.ready !== 'boolean') throw new Error('Ready must be true or false.');
    if (command.ready) this.readyIds.add(player.id);
    else this.readyIds.delete(player.id);
  }

  canLaunch() {
    return this.phase === 'lobby' && [0, 1].every(team => this.seats.some(seat =>
      seat.team === team && seat.connected && this.readyIds.has(seat.id)));
  }

  launch(player, revision) {
    this.requireSeat(player, true);
    this.requireRevision(revision);
    if (this.phase === 'running') return false;
    if (!this.canLaunch()) throw new Error('Both connected players must ready before launch.');
    this.phase = 'running';
    this.readyIds.clear();
    return true;
  }

  reset(mapId, armySize) {
    this.phase = 'lobby';
    this.mapId = mapId;
    this.armySize = armySize;
    this.invalidate();
  }

  checkpoint() { return { phase: this.phase, revision: this.revision }; }

  payload() {
    return {
      ...this.checkpoint(), mapId: this.mapId, armySize: this.armySize,
      mode: 'pvp', canLaunch: this.canLaunch(),
      seats: this.seats.map(seat => ({ ...seat, ready: this.readyIds.has(seat.id) })),
    };
  }
}
