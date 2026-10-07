// Storage is deferred so import and construction remain browser-independent.
// The host calls these operations at their original socket/welcome positions.
export function createWelcomeSession({ getStorage, sessionKey, instanceKey, matchKey }) {
  function readResumeToken() {
    let savedToken = null;
    try { savedToken = getStorage().getItem(sessionKey); } catch {}
    return savedToken;
  }

  function recordWelcomeIdentity(welcome) {
    let matchInstanceChanged = false;
    let matchIdentityChanged = false;
    if (typeof welcome.serverInstanceId === 'string') {
      try {
        const previousInstanceId = getStorage().getItem(instanceKey);
        matchInstanceChanged = Boolean(previousInstanceId && previousInstanceId !== welcome.serverInstanceId);
        getStorage().setItem(instanceKey, welcome.serverInstanceId);
      } catch {}
    }
    if (typeof welcome.matchId === 'string') {
      try {
        const previousMatchId = getStorage().getItem(matchKey);
        matchIdentityChanged = Boolean(previousMatchId && previousMatchId !== welcome.matchId);
        getStorage().setItem(matchKey, welcome.matchId);
      } catch {}
    }
    const matchWasReset = !welcome.recoveredFromCheckpoint && (matchIdentityChanged || matchInstanceChanged);
    const matchWasRestored = welcome.recoveredFromCheckpoint === true && matchInstanceChanged
      && !matchIdentityChanged;
    return { matchInstanceChanged, matchIdentityChanged, matchWasReset, matchWasRestored };
  }

  function recordWelcomeSeat(player, waitingForResume, lastRoom) {
    try {
      if (player.sessionToken) {
        getStorage().setItem(sessionKey, player.sessionToken);
        getStorage().setItem('thousand-unit-skirmish-last-room', lastRoom);
      }
      else if (!waitingForResume) getStorage().removeItem(sessionKey);
    } catch {}
  }

  return { readResumeToken, recordWelcomeIdentity, recordWelcomeSeat };
}
