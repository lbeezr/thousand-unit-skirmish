// The current protocol sends complete seat-filtered state, not dependent deltas.
// Keep at most one presentation update and use a correlated full refresh as the
// barrier after suspension. Transport delivery alone does not prove freshness.
export class BrowserStateRecovery {
  constructor({ visible = true } = {}) {
    this.visible = visible;
    this.epoch = null;
    this.tick = -1;
    this.pending = null;
    this.pendingWaypointCounts = null;
    this.recovering = false;
    this.request = null;
    this.nextRequestId = 1;
    this.lastRequestAt = -Infinity;
    this.progressAt = 0;
    this.serverNotAdvancing = false;
    this.previousFrameAt = null;
    this.snap = false;
    this.coalesced = 0;
    this.applied = 0;
  }

  reset(state, now) {
    this.epoch = `${state.serverInstanceId}:${state.matchId}`;
    this.tick = -1;
    this.pending = null;
    this.pendingWaypointCounts = null;
    this.request = null;
    this.recovering = false;
    this.lastRequestAt = now;
    this.progressAt = now;
    this.serverNotAdvancing = false;
    this.previousFrameAt = null;
    this.snap = true;
    this.receive(state, now);
  }

  suspend() {
    this.visible = false;
    this.recovering = true;
    this.pending = null;
    this.pendingWaypointCounts = null;
    this.request = null;
    this.previousFrameAt = null;
  }

  resume(now) {
    this.visible = true;
    this.recovering = true;
    this.pending = null;
    this.pendingWaypointCounts = null;
    this.request = null;
    this.lastRequestAt = -Infinity;
    this.progressAt = now;
    this.serverNotAdvancing = false;
    this.previousFrameAt = null;
    this.snap = true;
  }

  receive(state, now) {
    if (!this.visible || !state || !Number.isSafeInteger(state.tick) || state.tick < 0
      || `${state.serverInstanceId}:${state.matchId}` !== this.epoch || state.tick < this.tick) return false;
    const refresh = this.request && state.stateRefreshId === this.request.id;
    // Late acknowledgements and queued pre-resume broadcasts cannot satisfy
    // the freshness barrier, even when their tick is greater than our old tick.
    if (state.stateRefreshId !== undefined && !refresh) return false;
    if (this.recovering && !refresh) return false;
    if (refresh) {
      this.serverNotAdvancing = state.tick === this.tick && now - this.progressAt >= 10000;
      this.request = null;
    }
    if (state.tick > this.tick) { this.progressAt = now; this.serverNotAdvancing = false; }
    this.tick = state.tick;
    if (this.pending) this.coalesced++;
    this.pending = state;
    if (Array.isArray(state.queuedWaypointCounts)) this.pendingWaypointCounts = null;
    return true;
  }

  receiveWaypointCounts(rows) {
    if (!this.visible || (this.recovering && !this.pending) || !Array.isArray(rows)) return;
    this.pendingWaypointCounts = rows;
  }

  takeWaypointCounts() {
    if (!this.visible || this.recovering) return null;
    const rows = this.pendingWaypointCounts;
    this.pendingWaypointCounts = null;
    return rows;
  }

  poll(now) {
    if (!this.visible || !this.epoch) return null;
    if (this.recovering && this.pending) return null;
    if (this.request) return now - this.request.at >= 10000 ? { type: 'reconnect' } : null;
    if (!this.recovering && now - this.lastRequestAt < 5000) return null;
    this.request = { id: this.nextRequestId++, at: now };
    this.lastRequestAt = now;
    return { type: 'stateRefresh', stateRefreshId: this.request.id };
  }

  frame(now) {
    if (!this.visible) return null;
    if (!this.recovering && this.previousFrameAt !== null && now - this.previousFrameAt > 2000) this.resume(now);
    this.previousFrameAt = now;
    if (!this.pending) return null;
    const update = { state: this.pending, snap: this.snap };
    this.pending = null;
    this.snap = false;
    this.recovering = false;
    this.applied++;
    return update;
  }

  status(now) {
    if (!this.visible) return 'BACKGROUND';
    if (this.recovering) return 'SYNCING CURRENT STATE';
    if (this.request && now - this.request.at >= 5000) return 'AWAITING SERVER RESPONSE';
    if (this.serverNotAdvancing) return 'SERVER NOT ADVANCING';
    return null;
  }

  disconnect() {
    this.epoch = null;
    this.pending = null;
    this.pendingWaypointCounts = null;
    this.request = null;
    this.recovering = true;
    this.previousFrameAt = null;
  }
}
