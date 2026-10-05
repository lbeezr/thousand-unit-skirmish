import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import * as THREE from 'three';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { selectInspectableWildlife } from '../src/wildlife-client-state.mjs';

// CPU production picker with real rays and stock adapters; callers supply their
// camera, disclosed buildings/resources, fog and actual visible test geometry.
export function resourcePickingBindings() {
  return { farmHarvestNode, selectInspectableWildlife, latestWildlifeView: null,
    buildingVisuals: new Map(), pointerNdc: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
    groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    groundHit: new THREE.Vector3(), terrainSurface: null };
}

export function resourcePickingFunctionSource(source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')) {
  const declarations = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .filter(node => node.type === 'FunctionDeclaration');
  return ['worldAt', 'pickBuildingAt', 'pickResourceNodeAt'].map(name => {
    const matches = declarations.filter(node => node.id?.name === name);
    if (matches.length !== 1) throw new Error(`Expected one production ${name} function, found ${matches.length}`);
    return source.slice(matches[0].start, matches[0].end);
  }).join('\n');
}
