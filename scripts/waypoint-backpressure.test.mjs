import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { websocketFrameBytes } from '../src/networking/websocket-frame.mjs';
import { createPeerOutput } from '../src/server/transport/peer-output.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `server source boundaries: ${start}`);
  return source.slice(from, to);
}

function transport() {
  const frames = [];
  let rows = [[7, 1]];
  const context = vm.createContext({
    Buffer, websocketFrameBytes, createPeerOutput, MAX_PEER_QUEUED_BYTES: 1024, outboundQueueLimitDisconnects: 0,
    peakOutboundQueuedBytes: 0, lastWaypointQueueCountsByTeam: [[], []],
    snapshotQueuedWaypointCounts: (team) => team === 0 ? rows : [],
    prepareJsonFrame: (message) => Buffer.from(JSON.stringify(message)),
    peers: [], shuttingDown: false, process: { env: {}, connected: false },
    mapDefinition: { id: 'new-map' }, matchMode: { matchModeId: 'authored', matchModeVersion: 1 }, mapCatalogPayload: () => [],
    roomPayload: () => ({ type: 'state', mapId: 'new-map', queuedWaypointCounts: [] }),
  });
  vm.runInContext([
    between('function sendRoomMetadata()', 'function returnToPregame()'),
    between('const {\n  canQueuePeerFrame,', '\nlet inboundControlFramesReceived'),
    between('function broadcastWaypointQueueCounts()', 'function clientOrderToken('),
    `globalThis.peer = {
      team: 0, closed: false, backpressured: true, pendingState: null, pendingWaypointCounts: null,
      coalescedStateSnapshots: 0, peakQueuedBytes: 0,
      outboundJsonFrames: 0, outboundJsonWireBytes: 0,
      outboundJsonPayloadBytes: 0, outboundJsonUncompressedWireBytes: 0,
      ${between('    sendJson(message) {', '    close()')}
      terminate() { this.closed = true; },
    }; peers.push(peer);`,
  ].join('\n'), context);
  context.peer.socket = {
    writableLength: 0,
    write(frame) { frames.push(JSON.parse(frame)); return false; },
  };
  return {
    context, frames,
    queues(nextRows) { rows = nextRows; vm.runInContext('broadcastWaypointQueueCounts()', context); },
    state(tick) { context.peer.sendPreparedState(Buffer.from(JSON.stringify({ type: 'state', tick }))); },
    drain(writable = true) {
      context.peer.socket.write = (frame) => { frames.push(JSON.parse(frame)); return writable; };
      const body = between("  socket.on('drain', () => {", '\n  let session =').replace("  socket.on('drain', () => {", '').replace(/\n  \}\);\n$/, '');
      vm.runInContext(`(() => { ${body} })()`, context);
    },
  };
}

test('slow reader receives waypoint changes and the newest full snapshot', () => {
  const wire = transport();
  wire.queues([[7, 1]]);
  wire.state(10);
  wire.state(11);
  wire.drain();
  assert.deepEqual(wire.frames, [
    { type: 'state', tick: 11 },
    { type: 'waypointQueueCounts', rows: [[7, 1]] },
  ]);
});

test('latest queue clearing follows a roster-reset snapshot', () => {
  const wire = transport();
  wire.queues([[7, 1]]);
  wire.state(10);
  wire.queues([[7, 2]]);
  wire.state(11);
  wire.queues([]);
  wire.state(12);
  wire.drain();
  assert.deepEqual(wire.frames.filter((frame) => frame.type === 'waypointQueueCounts')
    .map((frame) => frame.rows), [[]]);
  assert.equal(wire.frames[0].tick, 12);
});

test('reliable queue metadata still respects the peer memory limit', () => {
  const wire = transport();
  wire.context.peer.socket.writableLength = 1024;
  wire.queues([[7, 1]]);
  wire.drain();
  assert.equal(wire.context.peer.closed, true);
  assert.equal(wire.context.outboundQueueLimitDisconnects, 1);
  assert.equal(wire.frames.length, 0);
});


test('counts follow a drained state even when its write backpressures again', () => {
  const wire = transport();
  wire.state(10);
  wire.queues([[7, 2]]);
  wire.drain(false);
  assert.deepEqual(wire.frames.map((frame) => frame.type), ['state', 'waypointQueueCounts']);
  assert.equal(wire.context.peer.pendingWaypointCounts, null);
});

test('map change discards both old snapshot and old queue metadata', () => {
  const wire = transport();
  wire.state(10);
  wire.queues([[7, 2]]);
  vm.runInContext('broadcastMapChange()', wire.context);
  wire.drain();
  assert.equal(wire.frames.length, 1);
  assert.equal(wire.frames[0].type, 'mapChange');
  assert.deepEqual(wire.frames[0].state.queuedWaypointCounts, []);
});

test('queue metadata is retained only for its owning seat', () => {
  const wire = transport();
  const forbidden = () => assert.fail('foreign queue metadata was sent');
  const other = { team: 1, sendPreparedWaypointCounts: forbidden };
  const spectator = { team: null, sendPreparedWaypointCounts: forbidden };
  wire.context.peers.push(other, spectator);
  wire.queues([[7, 2]]);
  wire.drain();
  assert.deepEqual(wire.frames[0].rows, [[7, 2]]);
});


test('same queue signature on a new map is delivered again', () => {
  const wire = transport();
  wire.queues([[7, 1]]);
  vm.runInContext('broadcastMapChange()', wire.context);
  wire.queues([[7, 1]]);
  wire.state(20);
  wire.drain();
  assert.deepEqual(wire.frames.map((frame) => frame.type),
    ['mapChange', 'state', 'waypointQueueCounts']);
  assert.deepEqual(wire.frames.at(-1).rows, [[7, 1]]);
});

function accountedPeer(write, queued = 0) {
  return {
    closed: false, backpressured: false, pendingState: null, pendingWaypointCounts: null,
    coalescedStateSnapshots: 0, peakQueuedBytes: 0,
    outboundJsonFrames: 0, outboundJsonWireBytes: 0, outboundJsonPayloadBytes: 0,
    outboundJsonUncompressedWireBytes: 0, outboundCompressedFrames: 0,
    outboundCompressedWireBytes: 0, outboundCompressedPayloadBytes: 0,
    socket: { writableLength: queued, write },
    terminate() { this.closed = true; },
  };
}

test('exact queue cap accepts a frame and accounts bytes before its unchanged write', () => {
  const events = [];
  let queued = 7;
  const frame = Buffer.from([0xc1, 1, 0x41]);
  frame.rtsPayloadBytes = 100;
  frame.rtsCompressed = true;
  const peer = accountedPeer(bytes => {
    assert.equal(bytes, frame, 'the original prepared buffer reaches the socket');
    assert.deepEqual([peer.outboundJsonFrames, peer.outboundJsonWireBytes,
      peer.outboundJsonPayloadBytes, peer.outboundJsonUncompressedWireBytes,
      peer.outboundCompressedFrames, peer.outboundCompressedWireBytes,
      peer.outboundCompressedPayloadBytes], [1, 3, 100, 102, 1, 3, 100]);
    events.push('write'); queued = 10; return false;
  });
  Object.defineProperty(peer.socket, 'writableLength', {
    get() { events.push(`read:${queued}`); return queued; },
  });
  const output = createPeerOutput(10, () => assert.fail('exact cap must not terminate'), bytes => {
    assert.equal(peer.peakQueuedBytes, 10); events.push(`peak:${bytes}`);
  });
  assert.deepEqual(events, [], 'factory construction performs no callbacks or queue reads');
  assert.equal(output.sendPreparedPeerFrame(peer, frame), false);
  assert.equal(peer.backpressured, true);
  assert.equal(peer.closed, false);
  assert.deepEqual(events, ['read:7', 'write', 'read:10', 'read:10', 'peak:10', 'read:10']);
});

test('pre-write queue rejection increments the aggregate before termination without accounting', () => {
  const events = [];
  const peer = accountedPeer(() => assert.fail('rejected frame must not be written'), 8);
  peer.terminate = () => { events.push('terminate'); peer.closed = true; };
  const output = createPeerOutput(10, () => events.push('limit'), () => assert.fail('no write peak'));
  assert.equal(output.sendPreparedPeerFrame(peer, Buffer.alloc(3)), false);
  assert.equal(peer.outboundJsonFrames, 0);
  assert.deepEqual(events, ['limit', 'terminate']);
});

test('post-write overflow records the peak and disconnect before returning without backpressure mutation', () => {
  const events = [];
  const peer = accountedPeer(() => { peer.socket.writableLength = 11; return false; }, 7);
  peer.terminate = () => { events.push('terminate'); peer.closed = true; };
  const output = createPeerOutput(10, () => events.push('limit'), bytes => events.push(`peak:${bytes}`));
  assert.equal(output.sendPreparedPeerFrame(peer, Buffer.alloc(3)), false);
  assert.equal(peer.peakQueuedBytes, 11);
  assert.equal(peer.outboundJsonFrames, 1);
  assert.equal(peer.backpressured, false);
  assert.deepEqual(events, ['peak:11', 'limit', 'terminate']);
});

test('socket write errors keep prior accounting and propagate before post-write callbacks', () => {
  const error = new Error('write fixture failure');
  const peer = accountedPeer(() => { throw error; });
  const output = createPeerOutput(10, () => assert.fail('no disconnect'), () => assert.fail('no post-write peak'));
  assert.throws(() => output.sendPreparedPeerFrame(peer, Buffer.alloc(3)), actual => actual === error);
  assert.equal(peer.outboundJsonFrames, 1);
  assert.equal(peer.outboundJsonWireBytes, 3);
  assert.equal(peer.peakQueuedBytes, 0);
  assert.equal(peer.backpressured, false);
});

test('a closed peer retains its pending buffers when drain does no work', () => {
  const peer = accountedPeer(() => assert.fail('closed peer must not write'));
  const state = Buffer.from('state'), counts = Buffer.from('counts');
  Object.assign(peer, { closed: true, backpressured: true, pendingState: state, pendingWaypointCounts: counts });
  const output = createPeerOutput(10, () => assert.fail('no disconnect'), () => assert.fail('no peak'));
  assert.equal(output.drainPeerOutput(peer), undefined);
  assert.equal(peer.pendingState, state);
  assert.equal(peer.pendingWaypointCounts, counts);
  assert.equal(peer.backpressured, true);
});
