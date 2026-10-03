// Compile-only contract: bytes enter the transport leaf; owned Buffer and numeric wire length leave it.
import { Buffer } from 'node:buffer';
import { encodeWebSocketFrame, websocketFrameBytes } from '../../src/networking/websocket-frame.mjs';

const storage = new Uint8Array([0xee, 10, 20, 30, 0xff]);
const payload = storage.subarray(1, 4);
/** @type {Buffer} */
const frame = encodeWebSocketFrame(0x1, payload);
/** @type {number} */
const wireBytes = websocketFrameBytes(payload.byteLength);
wireBytes.toFixed(0);
frame.readUInt16BE(0);
frame.subarray(2).equals(Buffer.from(payload));
encodeWebSocketFrame(0x1, Buffer.from('text', 'utf8'), true);
encodeWebSocketFrame(0x8, Buffer.from([0x03, 0xe8]), false);
