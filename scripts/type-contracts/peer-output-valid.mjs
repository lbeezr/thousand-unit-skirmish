// Compile-only consumer: encoded frames, queue metrics and peer write results.
import { Buffer } from 'node:buffer';
import { createPeerOutput } from '../../src/server/transport/peer-output.mjs';

let disconnects = 0;
let peakQueuedBytes = 0;
const output = createPeerOutput(1024,
  () => { disconnects++; },
  queuedBytes => { peakQueuedBytes = Math.max(peakQueuedBytes, queuedBytes); });

/** @type {import('../../src/server/transport/peer-output.mjs').DrainPeer} */
const peer = {
  closed: false,
  socket: { writableLength: 0, write: frame => frame.byteLength < 1024 },
  terminate() {},
  peakQueuedBytes: 0,
  backpressured: false,
  outboundJsonFrames: 0,
  outboundJsonWireBytes: 0,
  outboundJsonPayloadBytes: 0,
  outboundJsonUncompressedWireBytes: 0,
  outboundCompressedFrames: 0,
  outboundCompressedWireBytes: 0,
  outboundCompressedPayloadBytes: 0,
  pendingState: null,
  coalescedStateSnapshots: 0,
  pendingWaypointCounts: null,
  sendPreparedState(frame) { return output.sendPreparedState(peer, frame); },
};

const raw = Buffer.from([1, 2, 3]);
const offsetBytes = new Uint8Array([0, 1, 2, 0]).subarray(1, 3);
const compressed = Object.assign(Buffer.from([1]), { rtsCompressed: true, rtsPayloadBytes: 3 });
const uncompressed = Object.assign(Buffer.from([1, 2, 3]), { rtsCompressed: false, rtsPayloadBytes: 3 });
/** @type {boolean} */
const writable = output.sendPreparedPeerFrame(peer, compressed);
output.sendPreparedPeerFrame(peer, uncompressed);
output.sendPreparedPeerFrame(peer, raw);
output.sendPreparedPeerFrame(peer, offsetBytes);
output.sendPreparedState(peer, raw);
output.sendPreparedWaypointCounts(peer, raw);
output.recordPeerWrite(peer, writable);
output.drainPeerOutput(peer);

// Control-frame callers require only queue/write state, not JSON counters.
output.canQueuePeerFrame({ closed: false, socket: { writableLength: 0 }, terminate() {} }, raw.length);
output.recordPeerWrite({
  closed: false, socket: { writableLength: 0 }, terminate() {},
  peakQueuedBytes: 0, backpressured: false,
}, true);
