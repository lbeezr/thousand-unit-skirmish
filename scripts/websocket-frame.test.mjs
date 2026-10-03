import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeWebSocketFrame, websocketFrameBytes } from '../src/networking/websocket-frame.mjs';

const vectors = [
  [0, [0x81, 0]],
  [1, [0x81, 1]],
  [125, [0x81, 125]],
  [126, [0x81, 126, 0, 126]],
  [127, [0x81, 126, 0, 127]],
  [65535, [0x81, 126, 255, 255]],
  [65536, [0x81, 127, 0, 0, 0, 0, 0, 1, 0, 0]],
  [65537, [0x81, 127, 0, 0, 0, 0, 0, 1, 0, 1]],
];

for (const [size, bytes] of vectors) {
  test(`text frame preserves literal wire header and byte count for ${size} bytes`, () => {
    const payload = Buffer.alloc(size, 0xa5);
    const original = Buffer.from(payload);
    const header = Buffer.from(bytes);
    const frame = encodeWebSocketFrame(0x1, payload);
    assert.deepEqual(frame.subarray(0, header.length), header);
    assert.deepEqual(frame.subarray(header.length), original);
    assert.equal(websocketFrameBytes(size), size + header.length);
    assert.equal(frame.length, websocketFrameBytes(size));
    assert.deepEqual(payload, original, 'serialization leaves caller bytes unchanged');
    assert.equal(frame[1] & 0x80, 0, 'server frame remains unmasked');
  });
}

test('RSV1 preserves the existing compressed bit without transforming bytes', () => {
  for (const [size, bytes] of vectors) {
    const payload = Buffer.alloc(size, 0x42);
    const expected = Buffer.from(bytes); expected[0] = 0xc1;
    const frame = encodeWebSocketFrame(0x1, payload, true);
    assert.deepEqual(frame.subarray(0, expected.length), expected);
    assert.deepEqual(frame.subarray(expected.length), payload);
    assert.equal(frame.length, websocketFrameBytes(size));
  }
});

test('close, ping and pong retain final opcode and exact binary payload', () => {
  for (const [opcode, payload, expected] of [
    [0x8, Buffer.from([0x03, 0xe8]), [0x88, 2, 0x03, 0xe8]],
    [0x9, Buffer.from([0, 0xff, 0x41]), [0x89, 3, 0, 0xff, 0x41]],
    [0xa, Buffer.alloc(0), [0x8a, 0]],
  ]) assert.deepEqual(encodeWebSocketFrame(opcode, payload), Buffer.from(expected));
});

test('offset views and returned frames have independent byte ownership', () => {
  const source = new Uint8Array([0xee, 0xff, 10, 20, 30, 0xaa]);
  const payload = source.subarray(2, 5);
  const frame = encodeWebSocketFrame(0x1, payload);
  assert.deepEqual(frame, Buffer.from([0x81, 3, 10, 20, 30]));
  source[2] = 99;
  assert.equal(frame[2], 10, 'input changes cannot rewrite queued frames');
  frame[3] = 88;
  assert.equal(payload[1], 20, 'frame changes cannot rewrite caller storage');
});

test('large traffic estimates do not require allocating the payload', () => {
  assert.equal(websocketFrameBytes(2 ** 32), 2 ** 32 + 10);
});

test('invalid caller payloads remain programmer errors instead of empty frames', () => {
  assert.throws(() => encodeWebSocketFrame(0x1, null), TypeError);
  assert.throws(() => encodeWebSocketFrame(0x1, []), TypeError);
});
