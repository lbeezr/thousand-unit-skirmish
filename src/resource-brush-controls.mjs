import { createResourceBrushEditor, resourceBrushMapKey } from './resource-brush-authoring.mjs';

// DOM/canvas adapter; preview receipts and history live only in this editor session.
export function mountResourceBrushControls({ host, readMap, readSelectedId, commit, redraw, onCommitted }) {
  const panel = host.ownerDocument.createElement('details');
  panel.innerHTML = `<summary>RESOURCE PATCHES</summary>
    <div class="studio-fields">
      <div class="studio-fields two-up">
        <label>RESOURCE<select id="studio-brush-type"><option value="food">Food</option><option value="wood">Wood</option></select></label>
        <label>SEED<input id="studio-brush-seed" type="number" step="1" value="93000" required></label>
      </div>
      <label>TOTAL PATCH STOCK<input id="studio-brush-stock" type="number" min="5" step="1" value="300" required></label>
      <small>Five markers share this total budget, within four cells of the anchor.</small>
      <div class="studio-fields two-up">
        <label>ANCHOR COLUMN<input id="studio-brush-column" type="number" min="1" step="1" value="24" required></label>
        <label>ANCHOR ROW<input id="studio-brush-row" type="number" min="1" step="1" value="22" required></label>
      </div>
      <div class="studio-trigger-actions">
        <button type="button" data-brush="pick" aria-pressed="false">PICK ANCHOR</button>
        <button type="button" data-brush="preview">PREVIEW</button>
        <button type="button" data-brush="apply" disabled>APPLY PATCH</button>
        <button type="button" data-brush="cancel" disabled>CANCEL PREVIEW</button>
        <button type="button" data-brush="undo" disabled>UNDO PATCH</button>
        <button type="button" data-brush="redo" disabled>REDO PATCH</button>
      </div>
      <small role="status" aria-live="polite">Pick an anchor or enter its column and row, then preview.</small>
    </div>`;
  panel.open = true;
  host.append(panel);
  const field = name => panel.querySelector(`#studio-brush-${name}`);
  const buttons = Object.fromEntries([...panel.querySelectorAll('[data-brush]')].map(button => [button.dataset.brush, button]));
  const status = panel.querySelector('[role="status"]');
  let editor = null, observedKey = null, preview = null, picking = false;
  function refresh(available = true) {
    buttons.pick.disabled = buttons.preview.disabled = !available;
    buttons.pick.setAttribute('aria-pressed', String(picking));
    buttons.apply.disabled = !available || !preview;
    buttons.cancel.disabled = !available || !(preview || picking);
    buttons.undo.disabled = !available || !editor?.canUndo;
    buttons.redo.disabled = !available || !editor?.canRedo;
  }
  function cancel(message = 'Preview cancelled.') {
    const hadPreview = preview || picking;
    editor?.cancel(); preview = null; picking = false;
    if (hadPreview) { status.textContent = message; refresh(); redraw(); }
  }
  function sync() {
    try {
      const map = readMap();
      if (!map) { preview = null; picking = false; refresh(false); return false; }
      const key = resourceBrushMapKey(map);
      if (!editor) editor = createResourceBrushEditor({ readMap, readSelectedId, commit });
      else if (key !== observedKey) {
        editor.reset(); preview = null; picking = false;
        status.textContent = 'Map placement changed; preview again. Brush history cleared.';
      }
      observedKey = key;
      field('column').max = map.width; field('row').max = map.height;
      refresh(); return true;
    } catch (error) {
      preview = null; picking = false; editor = null; observedKey = null;
      status.textContent = error.message; refresh(false); return false;
    }
  }
  function showPreview() {
    if (!sync()) return;
    editor.cancel(); preview = null; picking = false;
    try {
      const values = {};
      for (const name of ['seed', 'stock', 'column', 'row']) {
        const input = field(name), value = Number(input.value);
        const valid = input.checkValidity() && input.value !== '' && Number.isSafeInteger(value);
        input.setAttribute('aria-invalid', String(!valid));
        if (!valid) { input.focus(); throw new Error(`Enter a valid whole number for ${input.labels[0].textContent.trim()}.`); }
        values[name] = value;
      }
      const map = readMap();
      preview = editor.preview({ type: field('type').value, seed: values.seed, totalStock: values.stock,
        x: values.column - map.width / 2 - 0.5, z: values.row - map.height / 2 - 0.5 });
      const stocks = preview.nodes.map(node => node.stock);
      status.textContent = `${preview.nodes.length} ${preview.settings.type} markers · ${values.stock} total stock · ${Math.min(...stocks)}–${Math.max(...stocks)} per marker · seed ${values.seed}. Apply to add.`;
      refresh(); buttons.apply.focus();
    } catch (error) { status.textContent = error.message; refresh(); }
    redraw();
  }
  function change(action) {
    if (!sync()) return;
    try {
      if (!editor[action]()) return;
      observedKey = resourceBrushMapKey(readMap()); preview = null; picking = false;
      status.textContent = action === 'apply' ? 'Patch applied. Undo restores the previous resources and selection.'
        : action === 'undo' ? 'Patch undone.' : 'Patch restored.';
      refresh(); buttons[action === 'undo' ? 'redo' : 'undo'].focus(); onCommitted();
    } catch (error) { status.textContent = error.message; refresh(); }
  }
  buttons.preview.addEventListener('click', showPreview);
  buttons.pick.addEventListener('click', () => {
    if (!sync()) return;
    cancel(); picking = true; refresh();
    status.textContent = 'Click a map cell to preview the patch there. Escape cancels.';
  });
  buttons.cancel.addEventListener('click', () => { cancel(); buttons.preview.focus(); });
  for (const action of ['apply', 'undo', 'redo']) buttons[action].addEventListener('click', () => change(action));
  panel.addEventListener('input', () => cancel('Settings changed; preview again.'));
  panel.addEventListener('change', () => cancel('Settings changed; preview again.'));
  panel.addEventListener('toggle', () => { if (!panel.open) cancel(); });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input, select')) { event.preventDefault(); showPreview(); }
  });
  const dialog = host.closest('dialog');
  dialog?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (preview || picking)) {
      event.preventDefault(); cancel(); buttons.preview.focus();
    }
  });
  dialog?.addEventListener('cancel', event => {
    if (preview || picking) { event.preventDefault(); cancel(); buttons.preview.focus(); }
  });
  dialog?.addEventListener('close', () => cancel());
  sync();
  return {
    get picking() { return picking; }, sync, cancel,
    reset() {
      preview = null; picking = false; editor = null; observedKey = null;
      status.textContent = 'Pick an anchor or enter its column and row, then preview.'; sync();
    },
    pickAt(cell) {
      if (!picking) return false;
      field('column').value = cell.column + 1; field('row').value = cell.row + 1;
      showPreview(); return true;
    },
    draw(context, map) {
      if (!preview) return;
      context.save(); context.setLineDash([0.16, 0.12]); context.lineWidth = 0.12;
      context.strokeStyle = preview.settings.type === 'wood' ? '#d5ef78' : '#ffe39a';
      context.fillStyle = '#fff'; context.font = '0.65px monospace'; context.textAlign = 'center';
      for (const node of preview.nodes) {
        const x = node.x + map.width / 2, y = node.z + map.height / 2;
        context.beginPath(); context.arc(x, y, 0.8, 0, Math.PI * 2); context.stroke();
        context.fillText(String(node.stock), x, y + 0.23);
      }
      context.restore();
    },
  };
}
