// Actor metadata is conservative: the context may expose changing getters.
// Command field values stay unknown until the existing transition checks them.
/** @typedef {{ id: number, team: number|null }} DrawOffer */
/** @typedef {{ winner: number, reason: 'resignation', resignedTeam: number|null }
 * | { winner: 2, reason: 'agreed-draw', agreedTeams: number[] }} EndingResult */
/** @typedef {{ version: number, generation: number, revision: number,
 * offer: DrawOffer|null, result: EndingResult|null }} EndingState */
/** @typedef {{ team: number|null, humanSeat: boolean, practice?: boolean, pve?: boolean,
 * started: boolean, winner: number, bothHumans: boolean }} EndingContext */
/** @typedef {{ version?: unknown, generation?: unknown, revision?: unknown,
 * action?: unknown, offerId?: unknown }} EndingCommand */
/** @typedef {{ version: number, generation: number, revision: number,
 * canResign: boolean, canOfferDraw: boolean, message: string, offer: DrawOffer|null }} EndingCapability */
/** @typedef {{ accepted: false, message: string }
 * | { accepted: true, message: string, result: EndingResult|null }} EndingDecision */
// A structural projection, not proof that a raw checkpoint has been validated.
/** @typedef {{ version: number, generation: number, revision: number,
 * result: EndingResult|null }} SavedEndingState */
// Separate from every mode's automatic victory policy. No timers or AI consent.
export const VOLUNTARY_ENDING_VERSION = 1;
export const VOLUNTARY_REASONS = ['resignation', 'agreed-draw'];
/** @returns {EndingState} */
export function freshVoluntaryEndings(version = VOLUNTARY_ENDING_VERSION, generation = 1) {
  return { version, generation, revision: 0, offer: null, result: null };
}

/** @param {EndingState} state @param {EndingContext} context @returns {EndingCapability} */
export function voluntaryCapability(state, { team, humanSeat, practice, pve, started, winner, bothHumans }) {
  let message = '';
  if (state.version !== 1) message = 'Unavailable in this recovered legacy match; reset to start a new match.';
  else if (!humanSeat) message = 'Only a current player seat can decide a match.';
  else {
    /** @type {readonly unknown[]} */
    const humanTeams = /** @satisfies {readonly [0, 1]} */ ([0, 1]);
    if (!humanTeams.includes(team)) message = 'Only a current player seat can decide a match.';
    else if (practice || pve) message = 'Voluntary endings are available in human PvP matches only.';
    else if (winner >= 0 || state.result) message = 'This match has already ended.';
    else if (!started) message = 'Start the match before using voluntary endings.';
  }
  return { version: state.version, generation: state.generation, revision: state.revision,
    canResign: !message, canOfferDraw: !message && bothHumans,
    message: message || (bothHumans ? 'Resign concedes the match. A draw requires both players to agree.'
      : 'You may resign. Draw agreement requires both human players to be connected.'),
    offer: winner < 0 && bothHumans && state.offer ? { ...state.offer } : null };
}

// Optimistic revision makes every accepted decision single-use, including an
// offer repeated after withdrawal. Network identity and seat ownership are
// checked by the composition root before this synchronous transition.
/** @param {EndingState} state @param {EndingCommand} command @param {EndingContext} context @returns {EndingDecision} */
export function decideVoluntaryEnding(state, command, context) {
  const capability = voluntaryCapability(state, context);
  /** @param {string} message @returns {{accepted:false,message:string}} */
  const reject = message => ({ accepted: false, message });
  if (!capability.canResign) return reject(capability.message);
  if (command.version !== 1 || command.generation !== state.generation || command.revision !== state.revision) return reject('Match decision is stale; use the current match actions.');
  const team = context.team;
  let message;
  if (command.action === 'resign') {
    state.result = { winner: 1 - (team === null ? 0 : team), reason: 'resignation', resignedTeam: team };
    message = 'Resignation accepted.';
  } else {
    if (!context.bothHumans) return reject('Draw agreement requires both human players to be connected.');
    if (command.action === 'offer') {
      if (state.offer) return reject('A draw offer is already pending.');
      state.offer = { id: state.revision + 1, team };
      message = 'Draw offered; waiting for the other player to agree.';
    } else {
      if (!state.offer || command.offerId !== state.offer.id) return reject('That draw offer is no longer pending.');
      if (command.action === 'withdraw') {
        if (state.offer.team !== team) return reject('Only the proposing player can withdraw this offer.');
        message = 'Draw offer withdrawn.';
      } else {
        /** @type {readonly unknown[]} */
        const responseActions = /** @satisfies {readonly ['accept', 'decline']} */ (['accept', 'decline']);
        if (!responseActions.includes(command.action)) return reject('Unknown match decision.');
        if (state.offer.team === team) return reject('The other player must answer your draw offer.');
        if (command.action === 'accept') state.result = { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] };
        message = command.action === 'accept' ? 'Both players agreed to a draw.' : 'Draw offer declined.';
      }
      state.offer = null;
    }
  }
  state.revision++;
  if (state.result) state.offer = null;
  return { accepted: true, message, result: state.result };
}

/** @param {EndingState} state @returns {boolean} */
export function cancelVoluntaryOffer(state) {
  if (!state.offer) return false;
  state.offer = null;
  state.revision++;
  return true;
}

// Pending offers intentionally are not durable consent. Version and revision
// persist; a cold restore cancels the offer and never replays a decision.
/** @param {EndingState} state @returns {SavedEndingState} */
export function savedVoluntaryEndings(state) {
  return { version: state.version, generation: state.generation, revision: state.revision, result: state.result && structuredClone(state.result) };
}
export function validSavedVoluntaryEndings(saved, { winner, reason, triggerId, started, practice, pve }) {
  if (!saved || ![0, 1].includes(saved.version) || !Number.isSafeInteger(saved.revision) || saved.revision < 0
    || !Number.isSafeInteger(saved.generation) || saved.generation < 1
    || Object.keys(saved).some(key => !['version', 'generation', 'revision', 'result'].includes(key))) return false;
  if (!VOLUNTARY_REASONS.includes(reason)) return saved.result === null;
  if (saved.version !== 1 || saved.revision < 1 || !started || practice || pve || triggerId !== null) return false;
  const result = saved.result;
  if (!result || result.reason !== reason || result.winner !== winner) return false;
  return reason === 'resignation'
    ? [0, 1].includes(result.resignedTeam) && winner === 1 - result.resignedTeam
      && Object.keys(result).length === 3
    : winner === 2 && JSON.stringify(result.agreedTeams) === '[0,1]' && Object.keys(result).length === 3;
}
export function migrateVoluntaryEndingCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 29 || !snapshot.state || Object.hasOwn(snapshot.state, 'voluntaryEndings')
    || VOLUNTARY_REASONS.includes(snapshot.state.matchWinnerReason)) return false;
  snapshot.state.voluntaryEndings = savedVoluntaryEndings(freshVoluntaryEndings(0));
  snapshot.schemaVersion = 30;
  return true;
}
