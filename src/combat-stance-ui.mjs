import { setHudActionAvailability, isHudActionUnavailable } from './hud-layout.mjs';

// Localized control text for the command IDs in docs/military-stances.md.
// Authoritative eligibility and stance come from generation-matched snapshots.
export const STANCE_CHOICES = Object.freeze([
  { id: 'aggressive', label: 'Aggressive', hint: 'Military only: acquire visible enemies within 4.8 cells; pursue up to 8 cells from the anchor.' },
  { id: 'defensive', label: 'Defensive', hint: 'Military only: acquire within 3 cells or weapon range; travel up to 3 cells from the anchor, then return.' },
  { id: 'standGround', label: 'Stand ground', hint: 'Military only: acquire in weapon range; never chase, even with focused Attack.' },
  { id: 'noAttack', label: 'No attack', hint: 'Military only: no automatic acquisition; explicit focused Attack still works.' },
]);
const valid = new Set(STANCE_CHOICES.map(choice => choice.id));
const orderHint = 'Keeps Move and queued waypoints; focused Attack has priority within this stance. Releases military Hold without moving. Stop clears orders and sets No attack.';

export function applyUnitStances(units, rows, team, definitions) {
  for (const unit of units) if (unit) unit.combatStance = null;
  if (![0, 1].includes(team) || !Array.isArray(rows)) return;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const [id, generation, stance] = row;
    const unit = Number.isInteger(id) && id >= 0 ? units[id] : null;
    if (!unit || unit.hp <= 0 || unit.team !== team || unit.kind === 'worker'
      || !definitions[unit.kind]?.capabilities.includes('attack')
      || !Number.isInteger(generation) || generation < 0 || unit.generation !== generation
      || !valid.has(stance)) continue;
    unit.combatStance = stance;
  }
}

export function stanceSelection({ units, ids, team, winner = -1, building = false, online = true }) {
  const selected = !building && [0, 1].includes(team) ? [...new Set(ids)].map(id => units[id])
    .filter(unit => unit?.hp > 0 && unit.team === team && valid.has(unit.combatStance)) : [];
  const values = new Set(selected.map(unit => unit.combatStance));
  return { selected, mixed: values.size > 1, stance: values.size === 1 ? [...values][0] : null,
    reason: winner >= 0 ? 'Match finished' : !online ? 'Connection offline' : '' };
}

export function updateCombatStanceControls(root, context) {
  const model = stanceSelection(context);
  for (const group of root.querySelectorAll('[data-stance-controls]')) {
    group.hidden = !model.selected.length;
    const status = group.querySelector('[data-stance-status]');
    const label = ['Stance', model.mixed ? 'Mixed' : '', model.reason].filter(Boolean).join(' · ');
    if (status.textContent !== label) status.textContent = label;
    for (const button of group.querySelectorAll('[data-combat-stance]')) {
      const choice = STANCE_CHOICES.find(item => item.id === button.dataset.combatStance);
      const pressed = model.stance === choice?.id;
      button.setAttribute('aria-pressed', String(pressed));
      button.querySelector('[data-stance-check]').hidden = !pressed;
      button.title = [choice?.hint, orderHint, model.reason].filter(Boolean).join(' ');
      setHudActionAvailability(button, !model.selected.length || Boolean(model.reason), true);
    }
  }
  return model;
}

export function bindCombatStanceControls(root, getContext, send) {
  const bindings = [...root.querySelectorAll('[data-combat-stance]')].map(button => {
    const handler = () => {
      const model = stanceSelection(getContext()), stance = button.dataset.combatStance;
      if (button.closest('[hidden]') || isHudActionUnavailable(button) || model.reason
        || !model.selected.length || !valid.has(stance)) return;
      send({ type: 'setStance', ids: model.selected.map(unit => unit.id),
        unitGenerations: model.selected.map(unit => unit.generation), stance });
      // The ordinary server notice/snapshot confirms this choice. A stance
      // command must not play a Move cue or optimistically mark itself applied.
    };
    button.addEventListener('click', handler);
    return () => button.removeEventListener('click', handler);
  });
  return () => bindings.forEach(dispose => dispose());
}
