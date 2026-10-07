// Saved roster limits and mode-specific roster/result invariants. The host
// validates individual records and references first; this function writes no state.
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../gameplay-definitions.mjs';
import { BANNERFALL_RULES, validateBannerfallState, bannerfallWinner } from '../bannerfall-rules.mjs';
import { VOLUNTARY_REASONS } from './voluntary-endings.mjs';

function assertSnapshot(condition, message) {
  if (!condition) throw new Error(`Invalid match checkpoint: ${message}`);
}

export function validateCheckpointRoster(state, savedMatchMode, {
  maxUnits: MAX_UNITS, maxTeamRoster: MAX_TEAM_ROSTER,
}) {
  const aliveByTeam = [0, 0];
  const queuedByTeam = state.workerProduction.map((production) => production.queue);
  for (const unit of state.units) if (unit.hp > 0) aliveByTeam[unit.team]++;
  for (const building of state.buildings) queuedByTeam[building.team] += building.queue;
  assertSnapshot(aliveByTeam.every((alive, team) => alive + queuedByTeam[team] <= MAX_TEAM_ROSTER),
    'team population exceeds its living-unit and queued-production cap');
  assertSnapshot(aliveByTeam[0] + aliveByTeam[1] + queuedByTeam[0] + queuedByTeam[1] <= MAX_UNITS,
    'match population exceeds its living-unit and queued-production cap');
  if (savedMatchMode.matchModeId === 'bannerfall') {
    validateBannerfallState(state.bannerfall, { units: state.units, elapsed: state.matchElapsedSeconds, maxUnits: MAX_UNITS });
    assertSnapshot(state.currentArmySize === BANNERFALL_RULES.openingArmySize
      && state.units.every(unit => ['infantry', 'rider'].includes(unit.kind))
      && state.units.every(unit => unit.kind !== 'rider'
        || state.bannerfall.kills[unit.team] === BANNERFALL_RULES.evolutionKills)
      && state.units.every(unit => unit.attackTargetId < 0
        || state.units[unit.attackTargetId].team !== unit.team)
      && [0, 1].every(team => state.units.reduce((sum, unit) => sum + (unit.team === team && unit.hp > 0
        ? UNIT_DEFINITIONS[unit.kind].population : 0), 0) <= BANNERFALL_RULES.populationCap)
      && state.teamFood.every(value => value === 0) && state.teamWood.every(value => value === 0)
      && state.teamStone.every(value => value === 0)
      && state.teamResearch.every(research => research === null)
      && state.teamUpgrades.every(upgrades => Object.values(upgrades).every(value => value === false))
      && state.buildings.length === 0 && state.workerProduction.every(production => production.queue === 0),
    'invalid Bannerfall roster or economy');
    assertSnapshot((VOLUNTARY_REASONS.includes(state.matchWinnerReason)
        ? bannerfallWinner(state.homeTownCenters.map(center => center.hp)) === -1
        : state.matchWinner === bannerfallWinner(state.homeTownCenters.map(center => center.hp))
          && state.matchWinnerReason === (state.matchWinner < 0 ? null : 'stronghold-destruction'))
      && state.matchWinnerTriggerId === null,
    'invalid Bannerfall stronghold result');
    if (!state.scenarioClockStarted) assertSnapshot(state.matchElapsedSeconds === 0
      && state.bannerfall.nextWaveIndex === 1 && state.bannerfall.kills.every(kills => kills === 0)
      && state.bannerfall.creditedGenerations.length === 0
      && state.units.length === BANNERFALL_RULES.openingArmySize
      && state.units.every(unit => unit.kind === 'infantry' && unit.hp === UNIT_DEFINITIONS.infantry.combat.maxHp)
      && aliveByTeam.every(alive => alive === BANNERFALL_RULES.openingArmySize / 2)
      && state.homeTownCenters.every(center => center.hp === BUILDING_DEFINITIONS['town-center'].maxHp),
    'waiting Bannerfall cannot contain completed gameplay');
  } else assertSnapshot(!Object.hasOwn(state, 'bannerfall') && state.matchWinnerReason !== 'stronghold-destruction',
    'Bannerfall state requires its explicit mode identity');
}
