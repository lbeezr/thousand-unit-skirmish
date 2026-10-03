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
