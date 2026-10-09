export const LOBBY_CHAT_LIMITS = Object.freeze({ textLength: 240, history: 32, retries: 64, sends: 5, windowMs: 10_000 });

/** Ephemeral room communication; authority stays with the existing seat sessions. */
export class RoomLobbyChat {
  constructor(now = Date.now) {
    this.now = now;
    this.messages = [];
    this.senders = new Map();
    this.nextId = 1;
  }

  history() { return this.messages.map(message => ({ ...message })); }

  send(player, command, lobby) {
    if (lobby.phase !== 'lobby') throw new Error('Room chat is available before launch.');
    if (![0, 1].includes(player.team)
      || !lobby.seats.some(seat => seat.connected && seat.id === player.id && seat.team === player.team)) {
      throw new Error('Only connected player seats can send room chat.');
    }
    if (Object.keys(command).some(key => !['type', 'clientMessageId', 'text'].includes(key))
      || typeof command.clientMessageId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(command.clientMessageId)) {
      throw new Error('Room chat requires a valid message identifier.');
    }
    if (typeof command.text !== 'string' || command.text.length > LOBBY_CHAT_LIMITS.textLength
      || /[\u0000-\u001f\u007f-\u009f]/u.test(command.text) || !command.text.trim()) {
      throw new Error('Send 1–240 characters of plain text, without control characters.');
    }
    const text = command.text.trim();
    // At most the two existing seats retain retry/rate records, including grace.
    const seatIds = new Set(lobby.seats.map(seat => seat.id));
    for (const id of this.senders.keys()) if (!seatIds.has(id)) this.senders.delete(id);
    let sender = this.senders.get(player.id);
    if (!sender) {
      sender = { seen: new Map(), sentAt: [] };
      this.senders.set(player.id, sender);
    }
    const previous = sender.seen.get(command.clientMessageId);
    if (previous) {
      if (previous.text !== text) throw new Error('This message identifier was already used for different text.');
      return { inserted: false, ack: { playerId: player.id, clientMessageId: command.clientMessageId } };
    }
    const now = this.now();
    sender.sentAt = sender.sentAt.filter(time => now - time < LOBBY_CHAT_LIMITS.windowMs);
    if (sender.sentAt.length >= LOBBY_CHAT_LIMITS.sends) {
      throw new Error('Room chat is busy. Wait a few seconds before sending again.');
    }
    const message = { id: this.nextId++, playerId: player.id, team: player.team,
      clientMessageId: command.clientMessageId, text };
    sender.sentAt.push(now);
    sender.seen.set(command.clientMessageId, message);
    if (sender.seen.size > LOBBY_CHAT_LIMITS.retries) sender.seen.delete(sender.seen.keys().next().value);
    this.messages.push(message);
    if (this.messages.length > LOBBY_CHAT_LIMITS.history) this.messages.shift();
    return { inserted: true, ack: { playerId: player.id, clientMessageId: command.clientMessageId } };
  }
}
