import { createRoomLobbyChat } from './room-lobby-chat-ui.mjs';
import { roomEntryUrl } from './game-entry-session.mjs';
import { createMatchModeControls, lobbyMapConfiguration, mapChoiceLabel } from './match-mode-controls.mjs';

const TEAMS = ['Azure', 'Ember'];
const SIZES = [250, 500, 1000, 2000];

export function lobbyRejoinUrl(currentUrl) {
  const current = new URL(currentUrl);
  const target = roomEntryUrl(currentUrl, current.searchParams.get('room') || 'default');
  if (!current.searchParams.has('room')) target.searchParams.set('play', '1');
  return target;
}

export function createRoomLobby({ root, send, copyInvite, rejoin = () => {
  const win = root.ownerDocument.defaultView;
  win.location.assign(lobbyRejoinUrl(win.location.href).href);
} }) {
  const doc = root.ownerDocument;
  function element(tag, text, parent = root) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  }
  root.setAttribute('aria-labelledby', 'room-lobby-title');
  element('h2', 'Pregame lobby').id = 'room-lobby-title';
  element('p', 'PvP · 1v1 · Frontier faction');
  const seats = element('ul');
  seats.setAttribute('aria-label', 'Player seats');
  const rows = TEAMS.map(name => element('li', name, seats));
  const mapLabel = element('label', 'Map');
  const map = element('select', null, mapLabel);
  map.id = 'lobby-map';
  const modes = createMatchModeControls({ root: element('section'), id: 'lobby-match-mode',
    onChange: identity => submit({ type: 'configureLobby', ...identity }) });
  const sizeLabel = element('label', 'Total starting units');
  const size = element('select', null, sizeLabel);
  size.id = 'lobby-army-size';
  const help = element('p', 'The host chooses settings. Changes and disconnects clear readiness.');
  help.className = 'room-lobby-help';
  const status = element('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.id = 'lobby-status';
  const actions = element('div');
  actions.className = 'room-lobby-actions';
  const invite = element('button', 'Copy invite', actions);
  const ready = element('button', 'Ready', actions);
  ready.id = 'lobby-ready';
  const launch = element('button', 'Launch match', actions);
  launch.id = 'lobby-launch';
  const join = element('button', 'Rejoin as player', actions);
  join.id = 'lobby-rejoin';
  const leave = element('a', 'Leave room', actions);
  leave.href = '/';
  for (const button of [invite, ready, launch, join]) button.type = 'button';
  let lobby = null;
  let player = null;
  let online = false;
  let pending = false;
  let pendingCommand = null;
  let currentMap = null;
  let pendingFocus = null;
  let rejoining = false;
  let rejection = '';
  const chat = createRoomLobbyChat({ root: element('section'), send });

  function canRejoin() {
    return lobby?.phase === 'lobby' && online && player?.team === null && !player.resumePending
      && [0, 1].some(team => !lobby.seats.some(seat => seat.team === team));
  }

  function seatGuidance(own) {
    if (!own) {
      if (player?.resumePending) return 'Your seat is active in another connection. Close it to rejoin automatically.';
      if (canRejoin()) return 'A player seat is available. Rejoin to request it; another player may join first.';
      return lobby.seats.some(seat => !seat.connected)
        ? 'Spectating · disconnected seats are reserved for their players.'
        : 'Spectating · both player seats are occupied.';
    }
    const other = lobby.seats.find(seat => seat.team !== own.team);
    if (own.team === 1 && !other) return 'Host seat open. Share the invite for a new Azure host; you remain Ember.';
    if (own.team === 1 && !other.connected) return 'Host disconnected. Azure is reserved while they reconnect; you remain Ember.';
    if (!other) return 'Waiting for Ember. Share the invite, then both players ready.';
    if (!other.connected) return 'Ember disconnected. Their seat is reserved while they reconnect.';
    return lobby.canLaunch ? 'Both players ready. The host can launch.' : 'Review the settings, then ready for this match.';
  }

  function render() {
    const visible = lobby?.phase === 'lobby';
    if (!visible) {
      modes.update({ identity: lobby || {}, online: false, editable: false });
      if (root.open) root.close();
      return;
    }
    const opening = !root.open;
    const own = lobby.seats.find(seat => seat.id === player?.id && seat.team === player?.team && seat.connected);
    const host = own?.team === 0;
    for (let team = 0; team < 2; team++) {
      const seat = lobby.seats.find(row => row.team === team);
      rows[team].textContent = `${TEAMS[team]}${team === 0 ? ' (host)' : ''}: ${!seat ? 'Waiting for player' : !seat.connected ? 'Disconnected · seat reserved' : seat.ready ? 'Ready' : 'Not ready'}${seat?.id === player?.id ? ' · You' : ''}`;
    }
    map.replaceChildren();
    for (const entry of lobby.maps) {
      let configuration = null;
      try { configuration = lobbyMapConfiguration(lobby, entry); } catch {}
      const option = element('option', mapChoiceLabel(entry, configuration), map);
      option.value = entry.id;
      option.disabled = !configuration;
    }
    map.value = lobby.mapId;
    size.replaceChildren();
    // Authored map openings can be smaller than the manual army-size presets.
    for (const count of [...new Set([lobby.armySize, ...SIZES])].sort((a, b) => a - b)) {
      const option = element('option', String(count), size);
      option.value = String(count);
    }
    size.value = String(lobby.armySize);
    modes.update({ identity: lobby, catalog: lobby.matchModes, map: currentMap, canonicalMap: null,
      online, editable: host, pending });
    const waiting = pending || modes.pending;
    map.disabled = size.disabled = !online || waiting || !host || !modes.supported;
    ready.disabled = !online || waiting || !own || !modes.supported;
    ready.textContent = own?.ready ? 'Not ready' : 'Ready';
    launch.hidden = !host;
    launch.disabled = !online || waiting || !host || !lobby.canLaunch || !modes.supported;
    const joinFocused = doc.activeElement === join;
    join.hidden = !canRejoin();
    join.disabled = join.hidden || pending || rejoining;
    if (joinFocused && join.hidden && root.open) invite.focus({ preventScroll: true });
    status.textContent = !online ? 'Reconnecting. Readiness clears when a player disconnects.'
      : rejection || (rejoining ? 'Rejoining room…' : waiting ? 'Waiting for server…' : seatGuidance(own));
    if (opening) {
      root.showModal();
      (host && !map.disabled ? map : own && !ready.disabled ? ready : !join.disabled ? join : invite).focus({ preventScroll: true });
    }
  }

  function restorePendingFocus() {
    if (pending) return;
    const target = pendingFocus;
    pendingFocus = null;
    // A user who moved to another enabled control while waiting keeps that focus.
    if (!target || !root.open || ![doc.body, root, target].includes(doc.activeElement)) return;
    (target.disabled || target.hidden ? invite : target).focus({ preventScroll: true });
  }

  function submit(command) {
    if (!lobby || pending || !online || lobby.phase !== 'lobby') return false;
    rejection = '';
    const focused = root.contains(doc.activeElement) ? doc.activeElement : null;
    pending = send({ ...command, revision: lobby.revision }) === true;
    pendingCommand = pending ? { ...command, revision: lobby.revision } : null;
    pendingFocus = pending ? focused : null;
    render();
    return pending;
  }
  map.addEventListener('change', () => {
    const entry = lobby?.maps.find(value => value.id === map.value);
    let configuration = null;
    try { if (entry) configuration = lobbyMapConfiguration(lobby, entry); } catch {}
    if (configuration) submit({ type: 'configureLobby', ...configuration });
    else render();
  });
  size.addEventListener('change', () => submit({ type: 'configureLobby', armySize: Number(size.value) }));
  ready.addEventListener('click', () => {
    const own = lobby?.seats.find(seat => seat.id === player?.id && seat.team === player?.team);
    submit({ type: 'setReady', ready: !own?.ready });
  });
  launch.addEventListener('click', () => submit({ type: 'launchMatch' }));
  invite.addEventListener('click', copyInvite);
  join.addEventListener('click', () => {
    if (!canRejoin() || pending || rejoining) return;
    rejoining = true;
    render();
    rejoin();
  });
  root.addEventListener('focusin', event => {
    if (pendingFocus && event.target !== pendingFocus) pendingFocus = null;
  });
  root.addEventListener('cancel', event => event.preventDefault());
  return {
    update(next, identity, connected = true, definition = currentMap) {
      const own = next?.seats.find(seat => seat.id === identity?.id && seat.team === identity?.team && seat.connected);
      const readyAccepted = pendingCommand?.type === 'setReady' && own?.ready === pendingCommand.ready;
      if (player?.id !== identity?.id || player?.team !== identity?.team || !connected || !own
        || next?.phase !== 'lobby' || next?.revision !== pendingCommand?.revision || readyAccepted) {
        pending = false; pendingCommand = null;
      }
      if (player?.id !== identity?.id || next?.phase !== 'lobby' || !connected) rejoining = false;
      lobby = next;
      player = identity;
      online = connected;
      currentMap = definition;
      rejection = '';
      chat.context(lobby, player, online);
      render();
      restorePendingFocus();
    },
    reject(message, next, identity) {
      lobby = next;
      player = identity;
      pending = false;
      pendingCommand = null;
      rejection = message;
      modes.reject(message);
      chat.context(lobby, player, online);
      render();
      restorePendingFocus();
    },
    updateChat(messages, ack, reset) { chat.update(messages, ack, reset); },
    rejectChat(message, clientMessageId) { chat.reject(message, clientMessageId); },
    disconnect() { online = false; pending = false; pendingCommand = null; pendingFocus = null; rejoining = false; chat.context(lobby, player, online); render(); },
  };
}
