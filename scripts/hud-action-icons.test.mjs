import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/ui/icons/actions/manifest.json', root), 'utf8'));
const dom = new JSDOM(readFileSync(new URL('index.html', root), 'utf8'));
const palette = new Set(['none', '#131b16', '#e5e8d7', '#d5ef78']);

test('default action set supplements every existing labelled control with a decorative 20px image', () => {
  assert.equal(manifest.status, 'default-labelled-controls');
  assert.deepEqual(manifest.sourceSize, [24, 24]);
  assert.deepEqual(manifest.reviewSizes, [16, 20, 24]);
  assert.deepEqual(manifest.actions.map(action => action.id),
    ['patrol', 'follow', 'stop', 'holdPosition', 'returnCargo', 'formation']);
  assert.deepEqual(manifest.actions.find(action => action.id === 'formation').selectionContexts,
    ['workers', 'military', 'mixed', 'boats'], 'Formation does not replace building rally/upgrade meaning');
  const server = readFileSync(new URL('src/server/client-static-assets.mjs', root), 'utf8');
  const allowlist = server.match(/const publicUiAsset = \[([\s\S]*?)\]\.includes\(relative\);/)[1];
  for (const action of manifest.actions) {
    assert.match(action.source, /^assets\/ui\/icons\/actions\/[a-z-]+\.svg$/);
    const controls = [...dom.window.document.querySelectorAll(action.selector)];
    assert.ok(controls.length, `${action.id} must map to an existing control`);
    for (const control of controls) {
      assert.equal(control.tagName, 'BUTTON');
      assert.ok(control.textContent.toLowerCase().includes(action.label.toLowerCase()),
        `${action.id} retains a visible action name`);
      const image = control.querySelector('img');
      assert.equal(image.getAttribute('src'), `/${action.source}`);
      assert.equal(image.getAttribute('alt'), '', 'visible text supplies the accessible name');
      assert.equal(image.getAttribute('width'), '20');
      assert.equal(image.getAttribute('height'), '20');
      assert.equal(image.hasAttribute('tabindex'), false, 'decorative images add no focus stop');
      assert.ok(control.classList.contains('contextual-icon-command'));
    }
    assert.ok(action.meaning.length > 20, `${action.id} has an explicit semantic boundary`);
    assert.ok(allowlist.includes(`'${action.source}'`), `${action.id} is served in normal gameplay`);
  }
});

for (const action of manifest.actions) {
  test(`${action.id} is a self-contained 24px vector with a matching accessible source name`, () => {
    const source = readFileSync(new URL(action.source, root), 'utf8');
    const document = new dom.window.DOMParser().parseFromString(source, 'image/svg+xml');
    assert.equal(document.querySelector('parsererror'), null, 'SVG must parse as XML');
    const svg = document.documentElement;
    assert.equal(svg.localName, 'svg');
    assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(svg.getAttribute('width'), '24');
    assert.equal(svg.getAttribute('height'), '24');
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(svg.getAttribute('role'), 'img');
    assert.equal(svg.getAttribute('aria-label'), action.label);
    assert.ok(svg.children.length, 'glyph must have vector shapes');
    for (const shape of [svg, ...svg.querySelectorAll('*')]) {
      if (shape !== svg) assert.ok(['path', 'rect', 'circle'].includes(shape.localName), 'only native vector primitives');
      for (const attribute of shape.attributes) {
        assert.ok(!/^on|href|style$/i.test(attribute.name), 'no script, embedding or external dependency');
        if (['fill', 'stroke'].includes(attribute.name)) assert.ok(palette.has(attribute.value));
        if (attribute.name === 'stroke-width') assert.ok(Number(attribute.value) >= 1 && Number(attribute.value) <= 2);
      }
    }
  });
}
