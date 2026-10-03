// Test-harness orders for the authored Fortified Crossing Barracks sites.
// Large formations can arrive here after an earlier set of occupants has left.
export function fortifiedSiteOccupants(state, team) {
  const x = team === 0 ? -18.5 : 18.5;
  // Snapshots round positions to two decimals. Include the footprint border
  // conservatively; the build command remains the authoritative empty-site check.
  return state.units.filter(unit => unit[1] === team && unit[4] > 0
    && unit[5] !== 'worker' && Math.abs(unit[2] - x) <= 1.51 && Math.abs(unit[3] + 3.5) <= 1.51);
}

export async function clearAndBuildFortifiedSite({ team, state, move, build,
  timeoutMs = 120_000, now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onSample = () => {} }) {
  const started = now();
  const redirected = new Set();
  let moveOrders = 0;
  let occupancyRetries = 0;
  let occupants = [];
  while (now() - started < timeoutMs) {
    occupants = fortifiedSiteOccupants(await state(), team);
    const fresh = occupants.filter(unit => !redirected.has(`${unit[0]}:${unit[8]}`));
    if (fresh.length) {
      await move(fresh, { x: team === 0 ? -30.5 : 30.5, z: -10.5 });
      for (const unit of fresh) redirected.add(`${unit[0]}:${unit[8]}`);
      moveOrders++;
    }
    onSample({ elapsedMs: now() - started, occupants: occupants.length,
      redirected: redirected.size, moveOrders, occupancyRetries });
    if (occupants.length === 0) {
      const notice = await build();
      if (notice.message.startsWith('BUILD ORDER')) {
        return { elapsedMs: now() - started, redirected: redirected.size,
          moveOrders, occupancyRetries };
      }
      // The authoritative check catches an arrival between snapshot and command.
      // Retry only that race; all other placement errors remain visible failures.
      if (notice.message !== 'BUILD REJECTED · UNITS IN FOOTPRINT') throw new Error(notice.message);
      occupancyRetries++;
    }
    await sleep(500);
  }
  throw new Error(`Fortified team ${team} site clearance timed out: ${occupants.length} occupants; ${redirected.size} redirected`);
}
