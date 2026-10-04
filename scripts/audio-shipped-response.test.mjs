import assert from 'node:assert/strict';
import test from 'node:test';
import * as canonical from '../src/client/audio/audio-shipped-response.mjs';
import * as legacy from '../src/audio-shipped-response.mjs';

const { readBoundedAudioResponse: read } = canonical;

test('canonical shipped reader retains the sole legacy export binding', () => {
  assert.deepEqual(Object.keys(canonical), ['readBoundedAudioResponse']);
  assert.deepEqual(Object.keys(legacy), ['readBoundedAudioResponse']);
  assert.equal(legacy.readBoundedAudioResponse, read);
});

const mime = 'audio/mpeg';
const headers = { 'content-type': mime };

test('reads multiple chunks at the exact limit and releases the reader', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3]));
      controller.close();
    },
  });
  const response = new Response(body, { headers: { 'content-type': `${mime}; charset=utf-8`, 'content-length': '3' } });
  assert.deepEqual(await read(response, 3, mime), new Uint8Array([1, 2, 3]));
  assert.equal(body.locked, false);
});

test('accepts an empty stream but reports a missing body', async () => {
  const empty = new Response(new Uint8Array(), { headers });
  assert.deepEqual(await read(empty, 3, mime), new Uint8Array());
  assert.equal(empty.body.locked, false);
  await assert.rejects(read(new Response(null, { headers }), 3, mime), /body is missing/);
});

test('rejects status, missing MIME, wrong MIME and declared overflow before reading', async () => {
  const cases = [
    [new Response('private response', { status: 403, headers }), /request failed/],
    [new Response(new Uint8Array()), /unexpected content type/],
    [new Response('private response', { headers: { 'content-type': 'text/html' } }), /unexpected content type/],
    [new Response('private response', { headers: { ...headers, 'content-length': '4' } }), /exceeds size limit/],
  ];
  for (const [response, message] of cases) {
    await assert.rejects(read(response, 3, mime), error => {
      assert.match(error.message, message);
      assert.doesNotMatch(error.message, /private response/);
      return true;
    });
    assert.equal(response.body.locked, false);
    assert.equal(response.bodyUsed, false);
  }
});

test('streamed overflow cancels the body once, releases the lock and rejects partial bytes', async () => {
  let canceled = 0;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(4)); },
    cancel() { canceled++; },
  });
  // A smaller declared length cannot bypass the streamed limit.
  await assert.rejects(read(new Response(body, { headers: { ...headers, 'content-length': '1' } }), 3, mime),
    { name: 'RangeError', message: 'Audio response exceeds size limit' });
  assert.equal(canceled, 1);
  assert.equal(body.locked, false);
});

test('transport and abort failures keep their original identity when cancel repeats the error', async () => {
  for (const failure of [new Error('transport failure'), new DOMException('aborted', 'AbortError')]) {
    const body = new ReadableStream({ pull(controller) { controller.error(failure); } });
    await assert.rejects(read(new Response(body, { headers }), 3, mime), error => error === failure);
    assert.equal(body.locked, false);
  }
});

test('a distinct cancellation failure retains the size failure as the cause and both errors', async () => {
  const cleanupError = new Error('cancel failed');
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(4)); },
    cancel() { throw cleanupError; },
  });
  await assert.rejects(read(new Response(body, { headers }), 3, mime), error => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.cause instanceof RangeError);
    assert.equal(error.errors[0], error.cause);
    assert.equal(error.errors[1], cleanupError);
    assert.equal(error.cause.message, 'Audio response exceeds size limit');
    return true;
  });
  assert.equal(body.locked, false);
});

test('an invalid fetch response remains a programmer error', async () => {
  await assert.rejects(read(undefined, 3, mime), TypeError);
});
