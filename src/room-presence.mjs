// @ts-check

/**
 * @typedef {object} RoomPresenceOptions
 * @property {number} connected Connected player count supplied by the room UI.
 * @property {boolean} [practice]
 * @property {boolean} [resumePending]
 */

/**
 * @typedef {object} RoomPresence
 * @property {'SEAT ACTIVE ELSEWHERE' | 'PRACTICE LIVE' | 'WAITING FOR A PLAYER' | 'ROOM LIVE' | 'WAITING FOR PLAYER 2'} network
 * @property {string} match
 * @property {boolean} waiting
 * @property {boolean} full
 */

/**
 * Checked callers supply numeric counts and boolean flags. Legacy untyped
 * callers retain the existing comparisons, strict Practice flag and recovery
 * truthiness; this presentation helper does not validate or allocate seats.
 * @param {RoomPresenceOptions} options
 * @returns {RoomPresence}
 */
export function roomPresence({ connected, practice = false, resumePending = false }) {
  return {
    network: resumePending ? 'SEAT ACTIVE ELSEWHERE'
      : practice === true ? connected > 0 ? 'PRACTICE LIVE' : 'WAITING FOR A PLAYER'
      : connected >= 2 ? 'ROOM LIVE' : 'WAITING FOR PLAYER 2',
    match: resumePending ? 'WAITING TO REJOIN'
      : practice === true && connected === 1 ? 'SOLO PRACTICE'
      : connected >= 2 ? `2 / 2 ONLINE${practice === true ? ' · PRACTICE' : ''}` : `${connected} / 2 ONLINE`,
    waiting: resumePending || (practice === true ? connected < 1 : connected < 2),
    full: connected >= 2,
  };
}
