import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createBuildingRotationSettings, buildingRotationKeyDirection,
  mountBuildingRotationControls, mountBuildingRotationSettings } from '../src/building-rotation-controls.mjs';
const enabled = { active: true, pending: false, editing: false, dialogOpen: false };

test('rotation uses remapped localized keys only in placement, preserving editing, camera and modifiers', () => {
  let saved; const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const settings = createBuildingRotationSettings(storage);
  assert.equal(buildingRotationKeyDirection({ key: '[' }, settings.get(), enabled), 1);
  assert.equal(buildingRotationKeyDirection({ key: ']' }, settings.get(), enabled), -1);
  for (const patch of [{ active: false }, { pending: true }, { editing: true }, { dialogOpen: true }])
    assert.equal(buildingRotationKeyDirection({ key: '[' }, settings.get(), { ...enabled, ...patch }), 0);
  for (const flag of ['defaultPrevented', 'repeat', 'isComposing', 'altKey', 'ctrlKey', 'metaKey'])
    assert.equal(buildingRotationKeyDirection({ key: '[', [flag]: true }, settings.get(), enabled), 0);
  for (const key of ['ArrowLeft', 'ArrowRight', ' ', '1', 'p', 's', 'a', 'm'])
    assert.equal(settings.set({ left: key, right: ']' }), false);
  assert.equal(settings.set({ left: 'é', right: 'ø' }), true);
  assert.deepEqual(createBuildingRotationSettings(storage).get(), { left: 'é', right: 'ø' });
  assert.equal(buildingRotationKeyDirection({ key: 'É' }, settings.get(), enabled), 1);
  assert.equal(buildingRotationKeyDirection({ key: '[' }, settings.get(), enabled), 0);
  assert.equal(settings.set({ left: 'é', right: 'É' }), false);
  assert.equal(settings.set({ left: '?', right: '+' }), true);
  assert.equal(buildingRotationKeyDirection({ key: '?', shiftKey: true }, settings.get(), enabled), 1);
  const broken = createBuildingRotationSettings({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  assert.equal(broken.set({ left: 'q', right: 'e' }), true);
});

test('visible controls turn once and settings update their labels/accessible shortcuts', () => {
  const dom = new JSDOM('<button data-building-rotate="left"></button><button data-building-rotate="right"></button><input data-building-rotation-key="left"><input data-building-rotation-key="right">');
  const settings = createBuildingRotationSettings(null), turns = [], doc = dom.window.document;
  mountBuildingRotationSettings(doc, settings); mountBuildingRotationControls(doc, settings, value => turns.push(value));
  doc.querySelectorAll('button').forEach(button => button.click()); assert.deepEqual(turns, [1, -1]);
  const input = doc.querySelector('input'); input.value = 'é'; input.dispatchEvent(new dom.window.Event('change'));
  assert.match(doc.querySelector('button').textContent, /é/);
  assert.equal(doc.querySelector('button').getAttribute('aria-keyshortcuts'), 'é');
  dom.window.close();
});
