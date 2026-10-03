import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCompatiblePerMessageDeflateOffer } from '../src/networking/websocket-deflate-offer.mjs';

const cases = [
  ['missing header', undefined, false],
  ['null header', null, false],
  ['array header', ['permessage-deflate'], false],
  ['object header', new String('permessage-deflate'), false],
  ['numeric header', 1, false],
  ['empty header', '', false],
  ['unrelated extension', 'gzip', false],
  ['bare deflate', 'permessage-deflate', true],
  ['trimmed and case-insensitive name', '  PERMESSAGE-DEFLATE  ', true],
  ['compatible offer after unrelated extension', 'gzip, permessage-deflate', true],
  ['both no-context flags', 'permessage-deflate; client_no_context_takeover; server_no_context_takeover', true],
  ['trimmed and case-insensitive flags', 'permessage-deflate; CLIENT_NO_CONTEXT_TAKEOVER ; SERVER_NO_CONTEXT_TAKEOVER ', true],
  ['bare client window option', 'permessage-deflate; client_max_window_bits', true],
  ['trimmed client window value', 'permessage-deflate; client_max_window_bits = 15 ', true],
  ['client flag with value', 'permessage-deflate; client_no_context_takeover=true', false],
  ['server flag with empty value', 'permessage-deflate; server_no_context_takeover=', false],
  ['duplicate option', 'permessage-deflate; client_max_window_bits; client_max_window_bits=15', false],
  ['case-insensitive duplicate flag', 'permessage-deflate; client_no_context_takeover; CLIENT_NO_CONTEXT_TAKEOVER', false],
  ['bare server window option', 'permessage-deflate; server_max_window_bits', false],
  ['default server window option is still declined', 'permessage-deflate; server_max_window_bits=15', false],
  ['unknown option', 'permessage-deflate; unknown', false],
  ['empty trailing option', 'permessage-deflate;', false],
  ['valid second offer after incompatible first', 'permessage-deflate; server_max_window_bits=12, permessage-deflate', true],
  ['no compatible offer in list', 'gzip, permessage-deflate; unknown, deflate', false],
  // Preserve the existing bounded split; this extraction does not change parsing policy.
  ['existing bounded value split', 'permessage-deflate; client_max_window_bits=15=extra', true],
  ...Array.from({ length: 8 }, (_, index) => [
    `client window ${index + 8}`, `permessage-deflate; client_max_window_bits=${index + 8}`, true,
  ]),
  ...['7', '16', '08', '"15"', ''].map(value => [
    `unsupported client window ${JSON.stringify(value)}`, `permessage-deflate; client_max_window_bits=${value}`, false,
  ]),
];

for (const [name, header, expected] of cases) {
  test(name, () => assert.equal(hasCompatiblePerMessageDeflateOffer(header), expected));
}
