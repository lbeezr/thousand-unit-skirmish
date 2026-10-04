export const BANNERFALL_RULES = Object.freeze({
  version: 1, waveSeconds: 15, waveSize: 2, populationCap: 12, evolutionKills: 6,
  openingArmySize: 16, initialKind: 'infantry', evolvedKind: 'rider', mapId: 'bannerfall-arena',
});

const MAX_UNITS = 2000;
const MAX_GENERATION = 0xffffffff;
const populationByKind = Object.freeze({ infantry: 1, rider: 2 });
const validTeam = team => team === 0 || team === 1;
const validKind = kind => kind === 'infantry' || kind === 'rider';
const integerIn = (value, minimum, maximum) => Number.isSafeInteger(value)
  && value >= minimum && value <= maximum;

function elapsedWaveIndex(elapsed) {
  const index = Math.floor(elapsed / BANNERFALL_RULES.waveSeconds) + 1;
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isSafeInteger(index)) {
    throw new Error('Invalid Bannerfall elapsed time');
  }
  return index;
}

export function createBannerfallState() {
  return { version: 1, nextWaveIndex: 1, kills: [0, 0], creditedGenerations: [] };
}

/**
 * Call only for the current unit's authoritative positive-HP to zero-HP transition.
 * The bounded ledger deduplicates its latest generation, including generation wrap;
 * it does not accept arbitrary historical death receipts from an external caller.
 */
export function creditBannerfallKill(state, victim, attackerTeam) {
  if (!victim || victim.hp !== 0 || !validKind(victim.kind)
    || !validTeam(victim.team) || !validTeam(attackerTeam) || victim.team === attackerTeam
    || !integerIn(victim.id, 0, MAX_UNITS - 1)
    || !integerIn(victim.generation, 1, MAX_GENERATION)) return false;
  const receipt = state.creditedGenerations.find(entry => entry[0] === victim.id);
  if (receipt?.[1] === victim.generation) return false;
  if (receipt) receipt[1] = victim.generation;
  else state.creditedGenerations.push([victim.id, victim.generation]);
  state.kills[attackerTeam] = Math.min(BANNERFALL_RULES.evolutionKills, state.kills[attackerTeam] + 1);
  return true;
}

export function bannerfallWaveKind(state, team) {
  if (!validTeam(team)) throw new Error('Invalid Bannerfall team');
  return state.kills[team] >= BANNERFALL_RULES.evolutionKills
    ? BANNERFALL_RULES.evolvedKind : BANNERFALL_RULES.initialKind;
}

/** Spawn must make accepted units immediately visible to populationForTeam. */
export function stepBannerfallWaves(state, elapsed, { populationForTeam, spawn }) {
  const nextWaveIndex = elapsedWaveIndex(elapsed);
  const result = { due: nextWaveIndex > state.nextWaveIndex, spawned: [0, 0] };
  if (!result.due) return result;
  // Missed, blocked and capped slots expire; only one bounded wave is attempted.
  state.nextWaveIndex = nextWaveIndex;
  for (const team of [0, 1]) {
    for (let slot = 0; slot < BANNERFALL_RULES.waveSize; slot++) {
      const kind = bannerfallWaveKind(state, team);
      const population = populationForTeam(team);
      if (!Number.isFinite(population) || population < 0) {
        throw new Error('Invalid Bannerfall population');
      }
      if (population + populationByKind[kind] > BANNERFALL_RULES.populationCap) continue;
      if (spawn(team, kind) === true) result.spawned[team]++;
    }
  }
  return result;
}

/** Unit kind/living population validation belongs to the authoritative runtime. */
export function validateBannerfallState(value, options = {}) {
  const { units = [], elapsed = 0, maxUnits = MAX_UNITS } = options;
  const latestWaveIndex = elapsedWaveIndex(elapsed);
  const fail = message => { throw new Error(`Invalid Bannerfall state: ${message}`); };
  if (!integerIn(maxUnits, 1, MAX_UNITS) || !Array.isArray(units)) fail('invalid restore context');
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 4
    || !['version', 'nextWaveIndex', 'kills', 'creditedGenerations'].every(key => Object.hasOwn(value, key))) {
    fail('expected exact state fields');
  }
  if (value.version !== BANNERFALL_RULES.version) fail('unsupported version');
  if (!integerIn(value.nextWaveIndex, 1, latestWaveIndex)) fail('invalid next wave index');
  if (!Array.isArray(value.kills) || value.kills.length !== 2
    || ![0, 1].every(team => integerIn(value.kills[team], 0, BANNERFALL_RULES.evolutionKills))) {
    fail('invalid kill counters');
  }
  if (!Array.isArray(value.creditedGenerations) || value.creditedGenerations.length > maxUnits) {
    fail('invalid kill receipt ledger');
  }
  const unitIds = new Set(units.map(unit => unit?.id));
  const ids = new Set();
  const receipts = [];
  for (const entry of value.creditedGenerations) {
    if (!Array.isArray(entry) || entry.length !== 2
      || !integerIn(entry[0], 0, maxUnits - 1) || !integerIn(entry[1], 1, MAX_GENERATION)
      || ids.has(entry[0]) || (Object.hasOwn(options, 'units') && !unitIds.has(entry[0]))) {
      fail('invalid or duplicate kill receipt identity');
    }
    ids.add(entry[0]);
    receipts.push([entry[0], entry[1]]);
  }
  return { version: value.version, nextWaveIndex: value.nextWaveIndex,
    kills: [...value.kills], creditedGenerations: receipts };
}

/** Core death is terminal; the runtime must never repair or replace a dead core. */
export function bannerfallWinner(coreHp) {
  if (!Array.isArray(coreHp) || coreHp.length !== 2
    || ![0, 1].every(team => Number.isFinite(coreHp[team]) && coreHp[team] >= 0)) {
    throw new Error('Invalid Bannerfall core HP');
  }
  if (coreHp[0] === 0 && coreHp[1] === 0) return 2;
  if (coreHp[0] === 0) return 1;
  if (coreHp[1] === 0) return 0;
  return -1;
}
