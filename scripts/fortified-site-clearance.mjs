// Test-harness orders for the authored Fortified Crossing Barracks sites.
// Large formations can arrive here after an earlier set of occupants has left.
export function fortifiedSiteOccupants(state, team) {
  const x = team === 0 ? -18.5 : 18.5;
  // Snapshots round positions to two decimals. Include the footprint border
  // conservatively; the build command remains the authoritative empty-site check.
  return state.units.filter(unit => unit[1] === team && unit[4] > 0
    && unit[5] !== 'worker' && Math.abs(unit[2] - x) <= 1.51 && Math.abs(unit[3] + 3.5) <= 1.51);
}

export async function sendFortifiedCommand(client, command, expected) {
  const terminal = new RegExp(`(?:${expected.source})|REJECTED|FAILED|MATCH OVER`, expected.flags);
  const notice = await client.command(command, terminal);
  if (!expected.test(notice.message)) throw new Error(notice.message);
  return notice;
}

export async function clearAndBuildFortifiedSite({ team, state, move, build,
  timeoutMs = 120_000, now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onSample = () => {} }) {
  const started = now();
  const redirected = new Set();
  let moveOrders = 0;
  let occupancyRetries = 0;
  let occupants = [];
  const remaining = () => timeoutMs - (now() - started);
  const timedOut = () => new Error(`Fortified team ${team} site clearance timed out: ${occupants.length} occupants; ${redirected.size} redirected`);
  async function withinDeadline(callback) {
    const budget = remaining();
    if (budget <= 0) throw timedOut();
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(callback),
        new Promise((_, reject) => { timer = setTimeout(() => reject(timedOut()), budget); }),
      ]);
      if (remaining() <= 0) throw timedOut();
      return result;
    } finally { clearTimeout(timer); }
  }
  while (remaining() > 0) {
    occupants = fortifiedSiteOccupants(await withinDeadline(state), team);
    const fresh = occupants.filter(unit => !redirected.has(`${unit[0]}:${unit[8]}`));
    if (fresh.length) {
      await withinDeadline(() => move(fresh, { x: team === 0 ? -30.5 : 30.5, z: -10.5 }));
      for (const unit of fresh) redirected.add(`${unit[0]}:${unit[8]}`);
      moveOrders++;
    }
    onSample({ elapsedMs: now() - started, occupants: occupants.length,
      redirected: redirected.size, moveOrders, occupancyRetries });
    if (occupants.length === 0) {
      const notice = await withinDeadline(build);
      if (notice.message.startsWith('BUILD ORDER')) {
        return { elapsedMs: now() - started, redirected: redirected.size,
          moveOrders, occupancyRetries };
      }
      // The authoritative check catches an arrival between snapshot and command.
      // Retry only that race; all other placement errors remain visible failures.
      if (notice.message !== 'BUILD REJECTED · UNITS IN FOOTPRINT') throw new Error(notice.message);
      occupancyRetries++;
    }
    await withinDeadline(() => sleep(Math.min(500, remaining())));
  }
  throw timedOut();
}
