// @ts-check
import { Buffer } from 'node:buffer';

/** @param {number} payloadBytes @returns {2 | 4 | 10} */
function frameHeaderBytes(payloadBytes) {
  return payloadBytes < 126 ? 2 : payloadBytes <= 0xffff ? 4 : 10;
}

/**
 * Encode one final, unmasked server frame. Callers own opcode/compression policy;
 * this leaf only writes bytes and never mutates or retains the payload.
 * @param {number} opcode
 * @param {Uint8Array} payload
 * @param {boolean} [compressed=false] Existing RSV1 flag; no compression here.
 * @returns {Buffer}
 */
export function encodeWebSocketFrame(opcode, payload, compressed = false) {
  const header = Buffer.alloc(frameHeaderBytes(payload.length));
  if (header.length === 2) {
    header[1] = payload.length;
  } else if (header.length === 4) {
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode | (compressed ? 0x40 : 0);
  return Buffer.concat([header, payload]);
}

/**
 * Same wire length used by queue limits and uncompressed traffic accounting.
 * @param {number} payloadBytes
 * @returns {number}
 */
export function websocketFrameBytes(payloadBytes) {
  return payloadBytes + frameHeaderBytes(payloadBytes);
}
