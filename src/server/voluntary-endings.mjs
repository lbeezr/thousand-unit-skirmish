// Separate from every mode's automatic victory policy. No timers or AI consent.
export const VOLUNTARY_ENDING_VERSION = 1;
export const VOLUNTARY_REASONS = ['resignation', 'agreed-draw'];
export function freshVoluntaryEndings(version = VOLUNTARY_ENDING_VERSION, generation = 1) {
  return { version, generation, revision: 0, offer: null, result: null };
}

export function voluntaryCapability(state, { team, humanSeat, practice, pve, started, winner, bothHumans }) {
  let message = '';
  if (state.version !== 1) message = 'Unavailable in this recovered legacy match; reset to start a new match.';
  else if (!humanSeat || ![0, 1].includes(team)) message = 'Only a current player seat can decide a match.';
  else if (practice || pve) message = 'Voluntary endings are available in human PvP matches only.';
  else if (winner >= 0 || state.result) message = 'This match has already ended.';
  else if (!started) message = 'Start the match before using voluntary endings.';
  return { version: state.version, generation: state.generation, revision: state.revision,
    canResign: !message, canOfferDraw: !message && bothHumans,
    message: message || (bothHumans ? 'Resign concedes the match. A draw requires both players to agree.'
      : 'You may resign. Draw agreement requires both human players to be connected.'),
    offer: winner < 0 && bothHumans && state.offer ? { ...state.offer } : null };
}

// Optimistic revision makes every accepted decision single-use, including an
// offer repeated after withdrawal. Network identity and seat ownership are
// checked by the composition root before this synchronous transition.
export function decideVoluntaryEnding(state, command, context) {
  const capability = voluntaryCapability(state, context);
  const reject = message => ({ accepted: false, message });
  if (!capability.canResign) return reject(capability.message);
  if (command.version !== 1 || command.generation !== state.generation || command.revision !== state.revision) return reject('Match decision is stale; use the current match actions.');
  const team = context.team;
  let message;
  if (command.action === 'resign') {
    state.result = { winner: 1 - team, reason: 'resignation', resignedTeam: team };
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
      } else if (['accept', 'decline'].includes(command.action)) {
        if (state.offer.team === team) return reject('The other player must answer your draw offer.');
        if (command.action === 'accept') state.result = { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] };
        message = command.action === 'accept' ? 'Both players agreed to a draw.' : 'Draw offer declined.';
      } else return reject('Unknown match decision.');
      state.offer = null;
    }
  }
  state.revision++;
  if (state.result) state.offer = null;
  return { accepted: true, message, result: state.result };
}

export function cancelVoluntaryOffer(state) {
  if (!state.offer) return false;
  state.offer = null;
  state.revision++;
  return true;
}

// Pending offers intentionally are not durable consent. Version and revision
// persist; a cold restore cancels the offer and never replays a decision.
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
