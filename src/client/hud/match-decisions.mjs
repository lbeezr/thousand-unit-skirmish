// Own only match actions, never unit commands or consent inferred from reconnect.
export function createMatchDecisions(document, send) {
  const root = document.querySelector('#match-decisions');
  const status = document.querySelector('#match-decisions-status');
  const confirmation = document.querySelector('#match-decision-confirmation');
  const confirmText = document.querySelector('#match-decision-confirm-text');
  const confirmButton = document.querySelector('#match-decision-confirm');
  const cancelButton = document.querySelector('#match-decision-cancel');
  const buttons = [...root.querySelectorAll('[data-match-decision]')];
  let snapshot = null, team = null, online = false, confirming = null, pending = null, lastRequest = null, feedback = '';
  const identity = state => state && `${state.serverInstanceId}/${state.matchId}`;
  const currentKey = () => snapshot && `${identity(snapshot)}/${snapshot.voluntaryEndings?.generation}/${snapshot.voluntaryEndings?.revision}`;
  function clearConfirmation() { confirming = null; confirmation.hidden = true; }
  function render() {
    const cap = snapshot?.voluntaryEndings;
    const offer = cap?.offer;
    status.textContent = !online ? 'Offline; match decisions cannot be sent.'
      : !cap?.canResign ? cap?.message || 'Match actions are unavailable on this server.'
      : feedback || (offer ? offer.team === team ? 'Draw offered; waiting for the other player to agree.'
        : 'The other player offers a draw. Accept only if you agree to end this match as a draw.'
      : cap?.message || 'Match actions are unavailable on this server.');
    for (const button of buttons) {
      const action = button.dataset.matchDecision;
      const relevant = action === 'resign' || action === 'offer' && !offer
        || action === 'withdraw' && offer?.team === team
        || ['accept', 'decline'].includes(action) && offer && offer.team !== team;
      button.hidden = !relevant || !cap?.canResign && !['resign', 'offer'].includes(action);
      button.disabled = !online || pending !== null || (action === 'resign' ? !cap?.canResign : !cap?.canOfferDraw);
    }
    confirmButton.disabled = !online || pending !== null;
  }
  function submit(action) {
    const cap = snapshot?.voluntaryEndings;
    if (!online || pending !== null || !cap?.canResign || action !== 'resign' && !cap.canOfferDraw) return;
    const request = { type: 'matchDecision', version: cap.version, generation: cap.generation, revision: cap.revision,
      serverInstanceId: snapshot.serverInstanceId, matchId: snapshot.matchId, action,
      ...(cap.offer ? { offerId: cap.offer.id } : {}) };
    clearConfirmation();
    if (send(request)) {
      pending = { key: identity(snapshot), generation: cap.generation, revision: cap.revision };
      lastRequest = { ...pending };
      feedback = 'Waiting for server confirmation; the match continues until the server accepts.';
    } else feedback = 'Decision was not sent. Wait for the current server state and try again.';
    render();
  }
  for (const button of buttons) button.addEventListener('click', () => {
    if (button.disabled || button.hidden) return;
    const action = button.dataset.matchDecision;
    if (['resign', 'offer', 'accept'].includes(action)) {
      confirming = { action, key: currentKey() };
      confirmText.textContent = action === 'resign' ? 'Resign this match? Your opponent will win.'
        : action === 'offer' ? 'Offer a draw? The match ends only if the other player agrees.'
          : 'Accept this draw? Both players will finish this match with a draw.';
      confirmButton.textContent = action === 'resign' ? 'Confirm resignation'
        : action === 'offer' ? 'Confirm draw offer' : 'Confirm draw agreement';
      confirmation.hidden = false;
      confirmButton.focus();
    } else submit(action);
  });
  confirmButton.addEventListener('click', () => {
    if (confirming?.key === currentKey()) submit(confirming.action);
    else { clearConfirmation(); render(); }
  });
  cancelButton.addEventListener('click', () => {
    const action = confirming?.action;
    clearConfirmation();
    buttons.find(button => button.dataset.matchDecision === action)?.focus();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && confirming) { event.preventDefault(); cancelButton.click(); }
  });
  document.querySelector('#match-menu-close')?.addEventListener('click', clearConfirmation);
  root.addEventListener('toggle', () => { if (!root.open) clearConfirmation(); });
  render();
  return {
    close() { clearConfirmation(); },
    update(state, currentTeam) {
      const changed = identity(snapshot) !== identity(state) || team !== currentTeam
        || snapshot?.voluntaryEndings?.generation !== state.voluntaryEndings?.generation;
      const revisionChanged = snapshot?.voluntaryEndings?.revision !== state.voluntaryEndings?.revision;
      if (changed || revisionChanged || state.winner >= 0) clearConfirmation();
      if (changed) { pending = null; lastRequest = null; feedback = ''; }
      else if (revisionChanged || state.winner >= 0) { pending = null; feedback = ''; }
      snapshot = state; team = currentTeam; online = true; render();
    },
    feedback(message) {
      if (identity(message) !== identity(snapshot) || lastRequest?.generation !== message.requestGeneration || lastRequest?.revision !== message.requestRevision) return;
      pending = null; lastRequest = null; feedback = message.message; clearConfirmation(); render();
    },
    disconnect() { online = false; pending = null; lastRequest = null; feedback = ''; clearConfirmation(); render(); },
  };
}
