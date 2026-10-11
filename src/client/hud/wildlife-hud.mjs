// Presentation only. Existing wildlife visibility, ownership, harvest-worker
// selection and command handlers remain responsible for eligibility and orders.
export function updateWildlifeHud(root, { wildlife, summary, connected, matchFinished, targeting }) {
  const identity = root.querySelector('[data-wildlife-identity]');
  const hint = root.querySelector('[data-wildlife-hint]');
  if (!identity || !hint) return;
  identity.hidden = hint.hidden = !wildlife;
  if (!wildlife) return;
  root.querySelector('.contextual-identity-text').hidden = true;
  root.querySelector('[data-unit-hud]').setAttribute('data-hud-panel', '');
  const carcass = wildlife.wildlifeState === 'carcass';
  root.querySelector('[data-wildlife-name]').textContent = carcass ? 'Sheep carcass' : 'Bellweather Sheep';
  root.querySelector('[data-wildlife-role]').textContent = carcass ? 'Food · Harvest' : 'Food · Herdable';
  root.querySelector('[data-wildlife-summary]').textContent = summary;
  hint.textContent = !connected ? 'Reconnecting — orders unavailable.' : matchFinished ? 'Match finished.'
    : carcass ? 'Harvest sends the nearest idle Worker with empty cargo. You can also select Workers and right-click this carcass.'
    : targeting ? 'Choose visible clear land to herd this Sheep · Esc to cancel.'
    : 'Herd moves this Sheep to visible clear land. Stop ends its current route.';
}
