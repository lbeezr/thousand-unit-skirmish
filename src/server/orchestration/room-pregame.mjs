import { normalizeMatchMode, assertMatchModeCompatibility, matchModeDefinition } from '../../match-modes.mjs';

export const LOBBY_ARMY_SIZES = Object.freeze([250, 500, 1000, 2000]);

/**
 * @typedef {object} PregameCheckpoint
 * @property {'lobby' | 'running'} phase
 * @property {number} revision Nonnegative safe integer, checked at the boundary.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPregameCheckpointRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is PregameCheckpoint['phase']} */
function isPregameCheckpointPhase(value) {
  return value === 'lobby' || value === 'running';
}

/** @param {unknown} value @returns {value is number} */
function isPregameCheckpointRevision(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Return only the field values that passed validation. Capturing each once
 * prevents changing accessors from substituting unchecked values in the result.
 * @param {unknown} value
 * @returns {PregameCheckpoint | null}
 */
export function validatePregameCheckpoint(value) {
  if (value === null) return null;
  if (!isPregameCheckpointRecord(value)
    || Object.keys(value).some(key => !['phase', 'revision'].includes(key))) {
    throw new TypeError('Invalid pregame checkpoint.');
  }
  const phase = value.phase;
  if (!isPregameCheckpointPhase(phase)) throw new TypeError('Invalid pregame checkpoint.');
  const revision = value.revision;
  if (!isPregameCheckpointRevision(revision)) throw new TypeError('Invalid pregame checkpoint.');
  return { phase, revision };
}

/**
 * Projected metadata stays unknown: this class does not validate its kinds.
 * Seat metadata is open; only the added readiness value is guaranteed.
 * @typedef {PregameCheckpoint & {
 * mapId: unknown, armySize: unknown, matchModeId: unknown, matchModeVersion: unknown,
 * mode: 'pvp', canLaunch: boolean,
 * seats: Array<Record<string, unknown> & {ready: boolean}>
 * }} PregamePayload
 */

/**
 * Dependencies required by a checked projection receiver. This does not enroll
 * the constructor, mutators, checkpoint or launch implementation in checkJs.
 * @typedef {{
 * checkpoint: () => PregameCheckpoint,
 * mapId: unknown, armySize: unknown,
 * matchModeId?: unknown, matchModeVersion?: unknown,
 * canLaunch: () => boolean,
 * seats: ReadonlyArray<Readonly<Record<string, unknown>>>, readyIds: ReadonlySet<unknown>
 * }} PregamePayloadSource
 */

/**
 * Trusted host sessions supply these fields; this is not runtime admission.
 * @typedef {{id: string, team: 0 | 1, connected: boolean}} PregameSeat
 */

/**
 * Receiver dependencies for the checked seat projection only. Other class
 * implementations and the payload's open metadata remain outside this contract.
 * @typedef {{
 * seats: ReadonlyArray<Readonly<PregameSeat>>,
 * phase: PregameCheckpoint['phase'], invalidate: () => void
 * }} PregameSeatSyncSource
 */

/** Uses the worker's existing seat sessions; never allocates identities or seats. */
export class RoomPregame {
  constructor(mapId, armySize, checkpoint = { phase: 'lobby', revision: 0 }, matchMode = {}) {
    const saved = validatePregameCheckpoint(checkpoint);
    if (!saved) throw new TypeError('Pregame phase is required.');
    this.phase = saved.phase;
    this.revision = saved.revision;
    this.mapId = mapId;
    this.armySize = matchModeDefinition(matchMode).fixedArmySize ?? armySize;
    Object.assign(this, normalizeMatchMode(matchMode));
    this.seats = [];
    this.readyIds = new Set();
  }

  invalidate() {
    this.revision++;
    this.readyIds.clear();
  }

  /**
   * Extra input metadata may be unknown or null; only the three seat fields project.
   * @this {PregameSeatSyncSource}
   * @param {ReadonlyArray<Readonly<PregameSeat> & Readonly<Record<string, unknown>>>} seats
   * @returns {boolean}
   */
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
    if (Object.keys(command).some(key => !['type', 'revision', 'mapId', 'armySize', 'matchModeId', 'matchModeVersion'].includes(key))) {
      throw new Error('Unknown lobby setting.');
    }
    const mapId = command.mapId ?? this.mapId;
    const map = typeof mapId === 'string' ? mapCatalog.get(mapId) : null;
    if (!map) throw new Error('Choose a map from this room’s catalog.');
    const matchMode = Object.hasOwn(command, 'matchModeId') || Object.hasOwn(command, 'matchModeVersion')
      ? normalizeMatchMode(command) : normalizeMatchMode(this);
    assertMatchModeCompatibility(matchMode, map);
    const mapChanged = mapId !== this.mapId;
    const fixedArmySize = matchModeDefinition(matchMode).fixedArmySize;
    const armySize = fixedArmySize ?? command.armySize ?? (mapChanged ? map.startingArmySize ?? 1000 : this.armySize);
    if (fixedArmySize && Object.hasOwn(command, 'armySize') && command.armySize !== fixedArmySize) {
      throw new Error('Bannerfall starts with 8 Infantry per side; its opening army is fixed.');
    }
    if (!fixedArmySize && Object.hasOwn(command, 'armySize') && !LOBBY_ARMY_SIZES.includes(command.armySize)) {
      throw new Error('Choose 250, 500, 1000 or 2000 total starting units.');
    }
    if (Object.hasOwn(command, 'mapId') && typeof command.mapId !== 'string') {
      throw new Error('Choose a map from this room’s catalog.');
    }
    if (mapId === this.mapId && armySize === this.armySize
      && matchMode.matchModeId === this.matchModeId && matchMode.matchModeVersion === this.matchModeVersion) return false;
    this.mapId = mapId;
    this.armySize = armySize;
    Object.assign(this, matchMode);
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

  reset(mapId, armySize, matchMode = this) {
    const identity = normalizeMatchMode(matchMode);
    this.phase = 'lobby';
    this.mapId = mapId;
    this.armySize = armySize;
    Object.assign(this, identity);
    this.invalidate();
  }

  checkpoint() { return { phase: this.phase, revision: this.revision }; }

  /** @this {PregamePayloadSource} @returns {PregamePayload} */
  payload() {
    return {
      ...this.checkpoint(), mapId: this.mapId, armySize: this.armySize,
      ...normalizeMatchMode(this),
      mode: 'pvp', canLaunch: this.canLaunch(),
      seats: this.seats.map(seat => ({ ...seat, ready: this.readyIds.has(seat.id) })),
    };
  }
}
