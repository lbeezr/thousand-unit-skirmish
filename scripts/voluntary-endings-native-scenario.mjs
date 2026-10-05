import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { matchRecap } from '../src/client/hud/match-recap.mjs';

const records = [];
const inherited = Object.fromEntries(['RTS_PREGAME', 'RTS_SOLO_PRACTICE', 'RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION'].map(key => [key, process.env[key]]));
for (const key of Object.keys(inherited)) delete process.env[key];
async function decision(client, action, more = {}) {
  const state = client.latest;
  const request = { type: 'matchDecision', version: 1, generation: state.voluntaryEndings.generation, revision: state.voluntaryEndings.revision,
    matchId: state.matchId, serverInstanceId: state.serverInstanceId, action,
    ...(state.voluntaryEndings.offer ? { offerId: state.voluntaryEndings.offer.id } : {}), ...more };
  const after = client.messages.length;
  client.send(request);
  return client.wait(message => message.type === 'matchDecisionFeedback'
    && message.requestGeneration === request.generation && message.requestRevision === request.revision, `${action} decision feedback`, after);
}

try {
  for (const [mode, mapPath] of [
    ['skirmish', 'maps/veyrholds-terraced-vale.json'],
    ['bannerfall', null],
    ['objective-control', 'maps/woodland-expanse.json'],
  ]) {
    const fixture = await createFortifiedFixture({ mapPath, matchModeId: mode, timeoutMs: 15000 });
    try {
      await fixture.start();
      let a = await fixture.connect(0), b;
      assert.equal(a.latest.voluntaryEndings.canResign, false, 'waiting match has no decision authority');
      b = await fixture.connect(1);
      await a.state(state => state.voluntaryEndings.canOfferDraw, 'both connected human seats start');
      await b.state(state => state.voluntaryEndings.canOfferDraw);
      const spectator = await fixture.connect(null);
      assert.equal((await decision(spectator, 'resign')).accepted, false, 'spectator cannot concede someone else’s match');
      assert.equal((await decision(a, 'resign', { matchId: 'old-match' })).accepted, false);
      assert.equal((await decision(a, 'resign', { serverInstanceId: 'old-process' })).accepted, false);
      assert.equal((await decision(a, 'offer')).accepted, true);
      await b.state(state => state.voluntaryEndings.offer?.team === 0);
      assert.equal((await decision(a, 'accept')).accepted, false, 'proposer is not both participants');
      assert.equal((await decision(b, 'accept', { offerId: 99 })).accepted, false);
      assert.equal((await decision(b, 'decline')).accepted, true);
      await a.state(state => !state.voluntaryEndings.offer && state.voluntaryEndings.revision === 2);
      assert.equal((await decision(a, 'offer', { revision: 0 })).accepted, false, 'old duplicate does not recreate an offer');
      assert.equal((await decision(b, 'offer')).accepted, true);
      await a.state(state => state.voluntaryEndings.offer?.team === 1);
      assert.equal((await decision(a, 'accept')).accepted, true);
      for (const [team, client] of [a, b].entries()) {
        const final = await client.state(state => state.winner === 2 && state.winnerReason === 'agreed-draw');
        assert.ok(matchRecap(final, team), 'accepted draw uses the same truthful recap');
        assert.equal(client.messages.filter(message => message.type === 'victory').length, 1);
        const elapsed = final.matchElapsedSeconds;
        assert.equal((await decision(client, 'resign')).accepted, false, 'terminal cannot be overwritten');
        const refreshAfter = client.messages.length;
        client.send({ type: 'stateRefresh', stateRefreshId: 1 });
        const frozen = await client.wait(message => message.type === 'stateRefresh', 'frozen terminal refresh', refreshAfter);
        assert.equal(frozen.matchElapsedSeconds, elapsed);
      }
      const terminal = await fixture.checkpoint(saved => saved.state.matchWinnerReason === 'agreed-draw');
      assert.equal(terminal.schemaVersion, 30);
      assert.deepEqual(terminal.state.voluntaryEndings.result, { winner: 2, reason: 'agreed-draw', agreedTeams: [0, 1] });
      const recapBefore = [matchRecap(a.latest, 0), matchRecap(b.latest, 1)];
      const tokens = [a.welcome.player.sessionToken, b.welcome.player.sessionToken];
      await fixture.stop(); await fixture.start();
      a = await fixture.connect(0, tokens[0]); b = await fixture.connect(1, tokens[1]);
      assert.ok(a.welcome.recoveredFromCheckpoint);
      assert.deepEqual([matchRecap(a.latest, 0), matchRecap(b.latest, 1)], recapBefore);
      assert.equal(a.messages.filter(message => message.type === 'victory').length, 0, 'restore displays saved result without a repeated victory event');
      const oldGeneration = a.latest.voluntaryEndings.generation;
      a.send({ type: 'reset' });
      await a.state(state => state.voluntaryEndings.generation !== oldGeneration && state.winner === -1 && state.voluntaryEndings.revision === 0);
      await b.state(state => state.voluntaryEndings.generation !== oldGeneration && state.voluntaryEndings.canResign);
      assert.equal((await decision(b, 'resign', { generation: oldGeneration, revision: 0 })).accepted, false,
        'same match/process identity cannot replay a previous-generation resignation');
      assert.equal(b.latest.winner, -1);
      assert.equal((await decision(b, 'resign')).accepted, true);
      const resigned = await a.state(state => state.winner === 0 && state.winnerReason === 'resignation');
      assert.ok(matchRecap(resigned, 0));
      records.push({ mode, result: 'both-seat agreement/decline/stale/duplicate/spectator/frozen/cold restore/rematch/Ember resignation pass' });
    } finally { await fixture.dispose(); }
  }
  const fixture = await createFortifiedFixture({ mapPath: 'maps/veyrholds-terraced-vale.json', matchModeId: 'skirmish', timeoutMs: 15000 });
  try {
    await fixture.start();
    let a = await fixture.connect(0), b = await fixture.connect(1);
    await a.state(state => state.voluntaryEndings.canOfferDraw);
    await b.state(state => state.voluntaryEndings.canOfferDraw);
    const token = b.welcome.player.sessionToken;
    assert.equal((await decision(a, 'offer')).accepted, true);
    await b.state(state => Boolean(state.voluntaryEndings.offer));
    const oldOffer = b.latest.voluntaryEndings.offer.id;
    b.socket.close();
    await a.state(state => !state.voluntaryEndings.canOfferDraw && !state.voluntaryEndings.offer);
    assert.equal(a.latest.winner, -1, 'disconnect is neither defeat nor agreement');
    b = await fixture.connect(1, token);
    await b.state(state => state.voluntaryEndings.canOfferDraw);
    assert.equal((await decision(b, 'accept', { offerId: oldOffer })).accepted, false);
    assert.equal((await decision(a, 'offer')).accepted, true);
    const offered = await fixture.checkpoint(saved => saved.state.voluntaryEndings.revision === a.latest.voluntaryEndings.revision && saved.state.voluntaryEndings.revision >= 3);
    assert.equal(Object.hasOwn(offered.state.voluntaryEndings, 'offer'), false);
    const tokens = [a.welcome.player.sessionToken, b.welcome.player.sessionToken];
    await fixture.stop(); await fixture.start();
    a = await fixture.connect(0, tokens[0]); b = await fixture.connect(1, tokens[1]);
    assert.equal(a.latest.voluntaryEndings.offer, null, 'pending consent is canceled on cold restore');
    await a.state(state => state.voluntaryEndings.canOfferDraw);
    assert.equal((await decision(a, 'offer')).accepted, true);
    await b.state(state => Boolean(state.voluntaryEndings.offer));
    assert.equal((await decision(a, 'withdraw')).accepted, true);
    await b.state(state => !state.voluntaryEndings.offer);
    assert.equal((await decision(a, 'resign')).accepted, true);
    await b.state(state => state.winner === 1 && state.winnerReason === 'resignation');
    const final = await fixture.checkpoint(saved => saved.state.matchWinnerReason === 'resignation');
    await fixture.stop();
    const legacy = structuredClone(final);
    legacy.schemaVersion = 29; delete legacy.state.voluntaryEndings;
    legacy.state.matchWinner = -1; legacy.state.matchWinnerReason = null;
    legacy.state.seatSessions = [];
    await writeFile(fixture.checkpointPath, JSON.stringify(legacy));
    await fixture.start(); a = await fixture.connect(0); b = await fixture.connect(1);
    assert.ok(a.welcome.recoveredFromCheckpoint, fixture.logs);
    assert.equal(a.latest.voluntaryEndings.version, 0);
    assert.equal((await decision(a, 'resign')).accepted, false);
    assert.match(a.latest.voluntaryEndings.message, /legacy/);
    const previousGeneration = a.latest.voluntaryEndings.generation;
    a.send({ type: 'reset' });
    await a.state(state => state.voluntaryEndings.generation !== previousGeneration && state.voluntaryEndings.version === 1);
    records.push({ mode: 'skirmish', result: 'Azure resignation, disconnect/resume cancellation, pending cold restore, withdrawal and exact schema29 legacy opt-in on reset pass' });
  } finally { await fixture.dispose(); }
  const normal = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 15000 });
  try {
    await normal.start();
    const response = await fetch(`http://127.0.0.1:${normal.port}/api/rooms`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'pvp', pregame: true }) });
    assert.equal(response.status, 201);
    const room = await response.json();
    const a = await normal.connect(0, null, room.roomId), b = await normal.connect(1, null, room.roomId);
    assert.equal(a.latest.matchModeId, 'skirmish');
    assert.equal(a.latest.voluntaryEndings.canResign, false);
    assert.equal((await decision(a, 'resign')).accepted, false, 'lobby cannot be conceded before launch');
    const revision = b.latest.lobby.revision;
    a.send({ type: 'setReady', revision, ready: true });
    b.send({ type: 'setReady', revision, ready: true });
    await a.wait(message => message.lobby?.canLaunch, 'both seats ready');
    a.send({ type: 'launchMatch', revision });
    await a.state(state => state.voluntaryEndings.canOfferDraw);
    await b.state(state => state.voluntaryEndings.canOfferDraw);
    assert.equal((await decision(a, 'offer')).accepted, true);
    await b.state(state => state.voluntaryEndings.offer?.team === 0);
    assert.equal((await decision(b, 'accept')).accepted, true);
    await a.state(state => state.winnerReason === 'agreed-draw');
    records.push({ mode: 'ordinary REST PvP', result: 'default Tiny Skirmish lobby/readiness/launch and real both-seat agreed draw pass' });
    for (const options of [{ mode: 'pve' }, { practice: true }]) {
      const response = await fetch(`http://127.0.0.1:${normal.port}/api/rooms`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(options) });
      assert.equal(response.status, 201);
      const room = await response.json();
      const seated = await normal.connect(0, null, room.roomId);
      assert.equal(seated.latest.voluntaryEndings.canResign, false);
      assert.equal(seated.latest.voluntaryEndings.canOfferDraw, false);
      assert.match(seated.latest.voluntaryEndings.message, /human PvP/);
      assert.equal((await decision(seated, 'offer')).accepted, false);
      assert.equal((await decision(seated, 'resign')).accepted, false);
      records.push({ mode: options.mode ?? 'Practice', result: 'normal entry explicitly unavailable; no invented AI acceptance or opponent victory' });
    }
  } finally { await normal.dispose(); }
  console.log(JSON.stringify({ scriptedNative: true, humanParticipants: 0, records }, null, 2));
} finally {
  for (const [key, value] of Object.entries(inherited)) value === undefined ? delete process.env[key] : process.env[key] = value;
}
