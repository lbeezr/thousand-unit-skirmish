import { matchModeDefinition, assertMatchModeCompatibility } from './match-modes.mjs';
import { mapVictoryRule } from './objective-summary.mjs';

const key = value => `${value.id}@${value.version}`;
const identityFor = value => ({ matchModeId: value.id, matchModeVersion: value.version });

// The caller supplies the runtime's allowed catalog and current map, when
// available. Presentation never projects a new simulation map or chooses AI.
export function matchModePresentation({ identity = {}, catalog, map, canonicalMap = map, opponentMode = 'pvp' } = {}) {
  try {
    const active = matchModeDefinition(identity);
    if (!['pvp', 'pve'].includes(opponentMode)) throw new Error('Unknown opponent setup.');
    if (opponentMode === 'pve' && !active.pveSupported) throw new Error('This mode is unavailable for Play vs AI.');
    const choices = new Map();
    if (Array.isArray(catalog)) for (const supplied of catalog) {
      try {
        const known = matchModeDefinition(identityFor(supplied));
        const descriptor = { ...known, selectable: known.selectable && supplied.selectable === true };
        if (opponentMode === 'pve' && !descriptor.pveSupported) continue;
        if (canonicalMap) assertMatchModeCompatibility(identityFor(descriptor), canonicalMap, { mode: opponentMode });
        if (descriptor.selectable || key(descriptor) === key(active)) choices.set(key(descriptor), descriptor);
      } catch { /* A newer/incompatible descriptor cannot become a local choice. */ }
    }
    const allowed = choices.has(key(active));
    if (!allowed) choices.set(key(active), active);
    const elimination = active.victoryPolicy === 'recovery-elimination';
    return {
      active, choices: [...choices.values()],
      editable: allowed && choices.size > 1,
      summary: elimination
        ? 'Defeat the opposing land force and its remaining ways to recover. Capture posts grant bonuses; holding them or reaching the map deadline does not win.'
        : 'This map’s authored victory rules apply. Review the win condition before readying.',
      rule: elimination
        ? 'Workers and paid land-unit queues keep a team alive, as does a completed producer that can afford and legally spawn a land unit. Skiffs alone do not. Losing a Town Center alone is not defeat.'
        : map ? mapVictoryRule(map).description : 'Capture, hold, deadline or elimination rules remain those of the authored map.',
      error: Array.isArray(catalog) && !allowed ? 'Current mode is unavailable for these settings. Review the map and mode before readying.' : '',
    };
  } catch (error) {
    return { active: null, choices: [], editable: false, summary: 'Mode unavailable.', rule: '',
      error: error.message === 'This mode is unavailable for Play vs AI.' ? error.message
        : 'This game version cannot configure the match’s mode. Reload to reconnect.' };
  }
}

// Catalog descriptors describe canonical compatibility. The map received by
// the browser may already have Skirmish's effective victory flags removed.
export function lobbyMapConfiguration(lobby, entry) {
  if (entry.selectable === false) return null;
  const active = matchModeDefinition(lobby);
  if (!Array.isArray(entry.matchModes)) return active.id === 'authored' ? { mapId: entry.id } : null;
  const allowed = entry.matchModes.flatMap(value => {
    try { return [matchModeDefinition(identityFor(value))]; } catch { return []; }
  });
  if (allowed.some(value => key(value) === key(active))) return { mapId: entry.id };
  const fallback = allowed.find(value => value.id === 'authored');
  return fallback ? { mapId: entry.id, ...identityFor(fallback) } : null;
}

export function mapChoiceLabel(entry, configuration) {
  const size = entry.sizeTierLabel && Number.isInteger(entry.width) && Number.isInteger(entry.height)
    ? `${entry.sizeTierLabel} · ${entry.width} × ${entry.height} · ` : '';
  const mode = configuration?.matchModeId ? ` · ${matchModeDefinition(configuration).label}` : '';
  return `${size}${entry.name}${entry.legacyCurrent ? ' · Current legacy map' : ''}${mode}`;
}

export function createMatchModeControls({ root, onChange, id = 'match-mode' }) {
  const doc = root.ownerDocument;
  root.classList.add('match-mode-controls');
  const label = doc.createElement('label');
  label.textContent = 'Victory mode';
  const select = doc.createElement('select');
  select.id = id;
  label.append(select); root.append(label);
  const summary = doc.createElement('p');
  summary.id = `${id}-summary`; summary.className = 'match-mode-summary'; root.append(summary);
  const details = doc.createElement('details');
  const title = doc.createElement('summary'); title.textContent = 'Win condition'; details.append(title);
  const rule = doc.createElement('p'); details.append(rule); root.append(details);
  const status = doc.createElement('p'); status.id = `${id}-status`; status.setAttribute('role', 'status'); root.append(status);
  select.setAttribute('aria-describedby', `${summary.id} ${status.id}`);
  let model = null, inputs = {}, request = null, pendingFocus = null, rejection = '';
  const waiting = () => Boolean(request) || inputs.pending === true;
  function render() {
    const values = model.choices.map(choice => [key(choice), choice.label]);
    if (!values.length) values.push(['', 'Mode unavailable']);
    if (JSON.stringify([...select.options].map(option => [option.value, option.textContent])) !== JSON.stringify(values)) {
      select.replaceChildren(...values.map(([value, text]) => {
        const option = doc.createElement('option'); option.value = value; option.textContent = text; return option;
      }));
    }
    select.value = model.active ? key(model.active) : '';
    select.disabled = !model.editable || inputs.editable !== true || inputs.online !== true || waiting();
    summary.textContent = model.summary; rule.textContent = model.rule;
    details.hidden = !model.rule;
    status.textContent = model.error || rejection || (waiting() ? 'Waiting for server…' : '');
  }
  function restorePendingFocus() {
    const target = pendingFocus;
    if (waiting()) return;
    pendingFocus = null;
    if (!target || target.disabled || !root.isConnected || root.closest('[hidden]')
      || root.closest('dialog')?.open === false
      || ![doc.body, doc.documentElement, root, target].includes(doc.activeElement)) return;
    target.focus({ preventScroll: true });
  }
  doc.addEventListener('focusin', event => {
    if (pendingFocus && ![pendingFocus, doc.body, doc.documentElement].includes(event.target)) pendingFocus = null;
  });
  select.addEventListener('change', () => {
    if (select.disabled) return;
    const choice = model.choices.find(value => key(value) === select.value);
    if (!choice || key(choice) === key(model.active)) { render(); return; }
    rejection = '';
    request = { from: key(model.active), to: key(choice) };
    pendingFocus = doc.activeElement === select ? select : null;
    if (onChange(identityFor(choice)) !== true) {
      request = null; pendingFocus = null;
      rejection = 'Mode choice was not sent. Reconnect and try again.';
    }
    render();
  });
  return {
    update(next) {
      inputs = next; model = matchModePresentation(next);
      const activeKey = model.active && key(model.active);
      if (next.online !== true || next.editable !== true || !model.active || model.error) {
        request = null; pendingFocus = null; rejection = '';
      } else if (request && activeKey !== request.from) {
        // Only an authoritative identity change settles a request. Unrelated
        // state/catalog updates, including pending:false, cannot allow a resend.
        request = null; rejection = '';
      }
      render(); restorePendingFocus();
    },
    reject(message) {
      if (!request) return;
      request = null; rejection = message || 'Mode choice was rejected. Review the settings and try again.';
      render(); restorePendingFocus();
    },
    get selectable() { return model?.editable === true; },
    get supported() { return Boolean(model?.active && !model.error); },
    get pending() { return waiting(); },
  };
}
