import { matchModePresentation, mapChoiceLabel } from './match-mode-controls.mjs';

// This is a local launch choice. It changes no room until Practice is selected.
export function createPracticeEntryControls({ root, onChange = () => {} }) {
  const select = root.querySelector('select'), summary = root.querySelector('[data-rule]');
  const mapName = root.querySelector('[data-map]');
  let setup = null, choices = [], chosen = null, supported = true;
  const key = choice => `${choice.id}@${choice.version}`;
  const identity = choice => ({ matchModeId: choice.id, matchModeVersion: choice.version });
  function describe() {
    if (!chosen) return;
    const view = matchModePresentation({ identity: identity(chosen), map: setup.map });
    summary.textContent = `${view.summary} ${view.rule}`;
  }
  select.addEventListener('change', () => {
    if (select.disabled) return;
    chosen = choices.find(choice => key(choice) === select.value) || chosen;
    select.value = key(chosen); describe(); onChange();
  });
  return {
    update(next, online, pending) {
      setup = next;
      const explicit = chosen && chosen.id !== 'authored';
      root.hidden = !setup && !explicit;
      const view = setup ? matchModePresentation({ identity: setup, catalog: setup.matchModes, map: setup.map }) : null;
      const available = Boolean(view?.active && !view.error && Array.isArray(setup.matchModes) && setup.map?.id);
      choices = available ? view.choices : [];
      // An interrupted/withheld catalog cannot replace the player's intent.
      chosen = choices.find(choice => chosen && key(choice) === key(chosen)) || chosen || view?.active;
      const allowed = chosen && choices.some(choice => key(choice) === key(chosen));
      supported = Boolean(allowed) || (!setup && !explicit);
      const options = [...choices];
      if (chosen && !allowed) options.push({ ...chosen, label: `${chosen.label} · unavailable` });
      if (!options.length) options.push({ id: '', version: '', label: 'Mode unavailable' });
      const values = options.map(choice => [key(choice), choice.label]);
      if (JSON.stringify([...select.options].map(option => [option.value, option.textContent])) !== JSON.stringify(values)) {
        select.replaceChildren(...values.map(([value, text]) => {
          const option = root.ownerDocument.createElement('option'); option.value = value; option.textContent = text;
          option.disabled = !choices.some(choice => key(choice) === value); return option;
        }));
      }
      select.value = chosen ? key(chosen) : '';
      select.disabled = !available || !online || pending || (allowed && choices.length < 2);
      mapName.textContent = available ? `Starts on ${mapChoiceLabel(setup.map)}.` : 'Practice settings are unavailable. Reload to reconnect.';
      if (allowed) describe();
      else summary.textContent = view?.error || (available
        ? 'Your chosen mode is unavailable. Choose an available mode before starting Practice.'
        : 'Your chosen rules are kept. Reconnect before starting Practice.');
    },
    get supported() { return supported; },
    get selectedLabel() { return chosen && chosen.id !== 'authored' ? chosen.label : ''; },
    // Send the reviewed rules even if a fresh-room default changes after lookup.
    get launchOptions() { return chosen ? identity(chosen) : {}; },
  };
}
