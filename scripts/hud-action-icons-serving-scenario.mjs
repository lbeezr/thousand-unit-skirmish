import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional packed root also verifies the actual release copy, without installing
// dependencies or changing/deploying a Railway environment.
const root = process.argv[2] || fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'assets/ui/icons/actions/manifest.json'), 'utf8'));
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-hud-icons-'));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1',
    RTS_CUSTOM_MAP_DIRECTORY: directory, RTS_MODE: 'pvp', RTS_ARMY_SIZE: '24' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', b => output = (output + b).slice(-8000));
const base = `http://127.0.0.1:${port}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(output);
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, output);
  const html = await (await fetch(`${base}/`)).text();
  for (const action of manifest.actions) {
    assert.ok(html.includes(`src="/${action.source}"`), `${action.id} is in the default served HTML`);
    const bytes = await readFile(path.join(root, action.source));
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/${action.source}`, { method });
      assert.equal(response.status, 200, `${method} ${action.id}`);
      assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
      const received = Buffer.from(await response.arrayBuffer());
      if (method === 'GET') assert.equal(hash(received), hash(bytes), `${action.id} source bytes`);
      else assert.equal(received.length, 0, 'HEAD has no response body');
    }
  }
  for (const sourceOnly of ['manifest.json', 'README.md', 'unapproved.svg']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/assets/ui/icons/actions/${sourceOnly}`, { method })).status, 404);
    }
  }
  console.log('Six default HUD action glyphs: labelled HTML, GET/HEAD MIME/hash checks; source-only/unapproved paths stay closed.');
} finally {
  child.kill('SIGINT');
  await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
