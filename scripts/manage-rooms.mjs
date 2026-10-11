// Operator-only client. Inject credentials through the existing secure runtime;
// never put them in command arguments. Inventory contains private invite codes.
const [action, originArgument, id] = process.argv.slice(2);
if (!['list', 'archive', 'restore'].includes(action) || !originArgument
  || (action !== 'list' && !/^[A-Za-z0-9_-]{32}$/.test(id || ''))) {
  throw new Error('Usage: node scripts/manage-rooms.mjs list|archive|restore ORIGIN [ROOM_ID]');
}
const origin = new URL(originArgument);
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
  || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
  throw new Error('Use an HTTPS origin or a loopback HTTP origin, without credentials, path or query.');
}
const password = process.env.RTS_ACCESS_PASSWORD;
if (!password) throw new Error('Inject RTS_ACCESS_PASSWORD through the existing secure operator environment.');
const authorization = `Basic ${Buffer.from(`${process.env.RTS_ACCESS_USER || 'players'}:${password}`).toString('base64')}`;
const response = await fetch(new URL(`/api/admin/rooms${action === 'list' ? '' : `/${id}/${action}`}`, origin), {
  method: action === 'list' ? 'GET' : 'POST', headers: { authorization, origin: origin.origin },
  redirect: 'error', signal: AbortSignal.timeout(20_000),
});
if (!response.ok) {
  const result = await response.json().catch(() => null);
  throw new Error(`Room management returned ${response.status}: ${result?.error || response.statusText}`);
}
console.log(JSON.stringify(await response.json(), null, 2));
