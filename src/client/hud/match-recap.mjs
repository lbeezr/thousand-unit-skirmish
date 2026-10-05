// Derive a recap from one accepted terminal DTO. No observed deltas or storage:
// fogged opponents and reused unit slots cannot establish lifetime totals.
const DRAW_REASONS = ['capture-hold', 'elimination', 'timed-control', 'stronghold-destruction', 'agreed-draw'];
const available = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const amount = value => available(value) ? String(Math.floor(value)) : 'unavailable';

export function matchRecap(state, team) {
  if (!state || ![0, 1].includes(state.winner)
    && !(state.winner === 2 && DRAW_REASONS.includes(state.winnerReason))) return null;
  const seconds = available(state.matchElapsedSeconds) ? Math.floor(state.matchElapsedSeconds) : null;
  const recap = {
    duration: seconds === null ? 'Duration unavailable'
      : `Duration ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    resources: '', survivors: '', posts: '',
    missing: 'Unavailable this match: income, spending, losses and earlier turning points.',
  };
  if (![0, 1].includes(team)) return recap;
  recap.resources = `Your remaining resources: ${amount(state.food?.[team])} Food · ${amount(state.wood?.[team])} Wood`;
  if (Object.hasOwn(state, 'stone')) recap.resources += ` · ${amount(state.stone?.[team])} Stone`;
  // Own alive count is authoritative even under fog. A missing roster must not
  // turn an unknown breakdown into zero. Count only living rows from this seat.
  const ownRows = Array.isArray(state.units)
    ? state.units.filter(row => Array.isArray(row) && row[1] === team && row[4] > 0) : null;
  const alive = state.alive?.[team];
  const completeRoster = Number.isInteger(alive) && alive >= 0 && ownRows?.length === alive
    && ownRows.every(row => typeof row[5] === 'string' && row[5].length > 0);
  if (completeRoster) {
    const workers = ownRows.filter(row => row[5] === 'worker').length;
    const other = alive - workers;
    recap.survivors = `Your surviving units: ${workers} ${workers === 1 ? 'Worker' : 'Workers'} · ${other} other ${other === 1 ? 'unit' : 'units'}`;
  } else recap.survivors = 'Your surviving units: unavailable';
  if (Array.isArray(state.objectives)
    && state.objectives.every(post => post && [-1, 0, 1].includes(post.owner))) {
    const held = state.objectives.filter(post => post.owner === team).length;
    recap.posts = `Posts held: ${held} of ${state.objectives.length}`;
    if (state.matchModeId === 'skirmish' && state.matchModeVersion === 1) recap.posts += ' · bonuses only';
  } else recap.posts = 'Posts held: unavailable';
  return recap;
}

export function renderMatchRecap(document, state, team) {
  const root = document.querySelector('#match-recap');
  if (!root) return;
  const recap = matchRecap(state, team);
  const wasHidden = root.hidden;
  root.hidden = recap === null;
  if (!recap || wasHidden) root.open = false;
  for (const key of ['duration', 'resources', 'survivors', 'posts', 'missing']) {
    const element = document.querySelector(`#match-recap-${key}`);
    if (!element) continue;
    const next = recap?.[key] ?? '';
    if (element.textContent !== next) element.textContent = next;
    element.hidden = !element.textContent;
  }
}
