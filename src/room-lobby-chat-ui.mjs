const TEAMS = ['Azure', 'Ember'];

export function createRoomLobbyChat({ root, send, createId = () =>
  root.ownerDocument.defaultView?.crypto?.randomUUID?.()
  || `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` }) {
  const doc = root.ownerDocument;
  function element(tag, text, parent = root) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  }
  root.className = 'room-lobby-chat';
  element('h3', 'Room chat');
  const log = element('ol');
  log.id = 'lobby-chat-log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Room chat messages');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');
  const form = element('form');
  const label = element('label', 'Message', form);
  const input = element('input', null, label);
  input.id = 'lobby-chat-text';
  input.maxLength = 240;
  input.autocomplete = 'off';
  const button = element('button', 'Send', form);
  button.id = 'lobby-chat-send';
  button.type = 'submit';
  const status = element('p', 'Chat lasts for this room server session.');
  status.id = 'lobby-chat-status';
  status.setAttribute('role', 'status');
  let lobby = null, player = null, online = false, pending = null, rejection = '';
  let pendingFocus = null;
  let messages = [];

  function ownSeat() {
    return lobby?.seats.find(seat => seat.connected && seat.id === player?.id && seat.team === player?.team);
  }
  function renderControls() {
    input.disabled = button.disabled = !online || lobby?.phase !== 'lobby' || !ownSeat() || Boolean(pending);
    status.textContent = !online ? 'Reconnecting. Your draft stays here.'
      : !ownSeat() ? 'Spectators can read room chat.'
      : rejection || (pending ? 'Sending…' : 'Chat lasts for this room server session.');
  }
  function renderHistory() {
    // Preserve existing log items so unrelated lobby updates do not reannounce them.
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    const known = new Map([...log.children].map(node => [Number(node.dataset.messageId), node]));
    for (const node of [...log.children]) if (!messages.some(message => message.id === Number(node.dataset.messageId))) node.remove();
    for (const message of messages) {
      let node = known.get(message.id);
      if (!node) {
        node = element('li', null, log);
        node.dataset.messageId = String(message.id);
      }
      const text = `${TEAMS[message.team]}${message.playerId === player?.id ? ' (you)' : ''}: ${message.text}`;
      if (node.textContent !== text) node.textContent = text;
    }
    if (atEnd) log.scrollTop = log.scrollHeight;
  }
  function restorePendingFocus() {
    const target = pendingFocus;
    pendingFocus = null;
    if (target && !target.disabled && [doc.body, target].includes(doc.activeElement)) target.focus({ preventScroll: true });
  }
  doc.addEventListener('focusin', event => {
    if (pendingFocus && ![pendingFocus, doc.body, doc.documentElement].includes(event.target)) pendingFocus = null;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (input.disabled || !input.value.trim()) return;
    const clientMessageId = createId();
    rejection = '';
    if (send({ type: 'sendLobbyChat', clientMessageId, text: input.value }) === true) {
      pending = clientMessageId;
      pendingFocus = [input, button].includes(doc.activeElement) ? doc.activeElement : null;
    }
    else rejection = 'Connection is offline. Your draft stays here.';
    renderControls();
  });
  return {
    context(next, identity, connected) {
      if (!connected || !online || player?.id !== identity?.id || player?.team !== identity?.team
        || lobby?.phase !== next?.phase) { pending = null; pendingFocus = null; rejection = ''; }
      lobby = next; player = identity; online = connected;
      renderHistory(); renderControls();
    },
    update(next, ack, reset = false) {
      if (reset) { log.replaceChildren(); pending = null; pendingFocus = null; rejection = ''; }
      messages = Array.isArray(next) ? next : [];
      let accepted = false;
      if (pending && ack?.playerId === player?.id && ack.clientMessageId === pending) {
        pending = null; input.value = ''; rejection = ''; accepted = true;
      }
      renderHistory(); renderControls();
      if (accepted) restorePendingFocus();
    },
    reject(message, clientMessageId) {
      if (pending !== clientMessageId) return;
      pending = null; rejection = message; renderControls(); restorePendingFocus();
    },
  };
}
