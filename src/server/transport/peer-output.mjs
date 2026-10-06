import { websocketFrameBytes } from '../../networking/websocket-frame.mjs';

// Queue policy and aggregate metrics stay host-owned; no peer is captured here.
// The callbacks run at the original counter/update positions, before termination.
export function createPeerOutput(maxQueuedBytes, onQueueLimitDisconnect, onQueuedBytes) {
  function canQueuePeerFrame(peer, frameBytes) {
    if (peer.closed) return false;
    const queuedBytes = peer.socket.writableLength;
    if (frameBytes > maxQueuedBytes || queuedBytes + frameBytes > maxQueuedBytes) {
      onQueueLimitDisconnect();
      peer.terminate();
      return false;
    }
    return true;
  }

  function sendPreparedPeerFrame(peer, frame) {
    if (!canQueuePeerFrame(peer, frame.length)) return false;
    peer.outboundJsonFrames++;
    peer.outboundJsonWireBytes += frame.length;
    peer.outboundJsonPayloadBytes += frame.rtsPayloadBytes ?? frame.length;
    peer.outboundJsonUncompressedWireBytes += websocketFrameBytes(frame.rtsPayloadBytes ?? frame.length);
    if (frame.rtsCompressed) {
      peer.outboundCompressedFrames++;
      peer.outboundCompressedWireBytes += frame.length;
      peer.outboundCompressedPayloadBytes += frame.rtsPayloadBytes;
    }
    return recordPeerWrite(peer, peer.socket.write(frame));
  }

  function recordPeerWrite(peer, writable) {
    peer.peakQueuedBytes = Math.max(peer.peakQueuedBytes, peer.socket.writableLength);
    onQueuedBytes(peer.socket.writableLength);
    if (peer.socket.writableLength > maxQueuedBytes) {
      onQueueLimitDisconnect();
      peer.terminate();
      return false;
    }
    if (!writable) peer.backpressured = true;
    return writable;
  }

  function sendPreparedState(peer, frame) {
    if (peer.closed) return false;
    if (peer.backpressured) {
      if (peer.pendingState) peer.coalescedStateSnapshots++;
      peer.pendingState = frame;
      return false;
    }
    return sendPreparedPeerFrame(peer, frame);
  }

  function sendPreparedWaypointCounts(peer, frame) {
    if (peer.closed) return false;
    if (peer.backpressured) {
      peer.pendingWaypointCounts = frame;
      return false;
    }
    return sendPreparedPeerFrame(peer, frame);
  }

  function drainPeerOutput(peer) {
    if (peer.closed) return;
    peer.backpressured = false;
    const latestState = peer.pendingState;
    const latestWaypointCounts = peer.pendingWaypointCounts;
    peer.pendingState = null;
    peer.pendingWaypointCounts = null;
    if (latestState) peer.sendPreparedState(latestState);
    // The state may reset the client's roster. Its owner counts must follow it,
    // even if writing that state re-enters backpressure. The byte limit still
    // applies to this single metadata frame.
    if (latestWaypointCounts) sendPreparedPeerFrame(peer, latestWaypointCounts);
  }

  return { canQueuePeerFrame, sendPreparedPeerFrame, recordPeerWrite,
    sendPreparedState, sendPreparedWaypointCounts, drainPeerOutput };
}
