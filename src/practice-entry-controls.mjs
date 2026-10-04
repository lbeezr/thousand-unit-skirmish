import { matchModePresentation } from './match-mode-controls.mjs';

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
      root.hidden = !setup;
      if (!setup) { choices = []; chosen = null; supported = true; return; }
      const view = matchModePresentation({ identity: setup, catalog: setup.matchModes, map: setup.map });
      supported = Boolean(view.active && !view.error && Array.isArray(setup.matchModes) && setup.map?.id);
      choices = supported ? view.choices : [];
      chosen = choices.find(choice => chosen && key(choice) === key(chosen)) || view.active;
      const options = choices.length ? choices : [{ id: '', version: '', label: 'Mode unavailable' }];
      const values = options.map(choice => [key(choice), choice.label]);
      if (JSON.stringify([...select.options].map(option => [option.value, option.textContent])) !== JSON.stringify(values)) {
        select.replaceChildren(...values.map(([value, text]) => {
          const option = root.ownerDocument.createElement('option'); option.value = value; option.textContent = text; return option;
        }));
      }
      select.value = chosen ? key(chosen) : '';
      select.disabled = !supported || !online || pending || choices.length < 2;
      mapName.textContent = supported ? `Starts on ${setup.map.name}.` : 'Practice rules changed. Reload to reconnect.';
      if (supported) describe(); else summary.textContent = view.error || 'Practice setup is unavailable.';
    },
    get supported() { return supported; },
    get selectedLabel() { return chosen && chosen.id !== 'authored' ? chosen.label : ''; },
    get launchOptions() { return chosen && chosen.id !== 'authored' ? identity(chosen) : {}; },
  };
}
