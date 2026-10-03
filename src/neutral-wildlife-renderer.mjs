import { validWildlifeNodeDefinition, validWildlifeNodeState } from './wildlife-state.mjs';
import { createStaticSheepRuntime } from './sheep-static-preview.mjs';

// Stationary neutral resource presentation. Nose pose is not movement direction.
export const WILDLIFE_RENDER_REGISTRY = Object.freeze({
  'bellweather-sheep': Object.freeze({
    alive: 'public-illustrated-static',
    aliveFallback: 'sheep-proxy',
    carcassFallback: 'food-cache-marker',
    depleted: 'hidden',
    bindingUrl: new URL('../assets/wildlife/bellweather-sheep-public-reference-v1/static-preview-binding.json', import.meta.url).href,
  }),
});

export function wildlifePresentation(definition, snapshot, visible) {
  if (visible !== true || !WILDLIFE_RENDER_REGISTRY[definition?.wildlifeSpecies]
    || typeof definition.id !== 'string' || !definition.id
    || !validWildlifeNodeDefinition(definition) || definition.type !== 'food'
    || !Number.isFinite(definition.stock) || definition.stock <= 0
    || snapshot?.id !== definition.id || snapshot.type !== definition.type
    || !Number.isFinite(snapshot.stock) || snapshot.stock < 0 || snapshot.stock > definition.stock
    || !validWildlifeNodeState(snapshot, definition)) return 'hidden';
  return snapshot.wildlifeState;
}

function fallbackMeshes(THREE) {
  const alive = new THREE.Group(), carcass = new THREE.Group();
  const cream = new THREE.MeshBasicMaterial({ color: 0xe5d4b4 });
  const pale = new THREE.MeshBasicMaterial({ color: 0xcdbb9d });
  const dark = new THREE.MeshBasicMaterial({ color: 0x685144 });
  function ellipsoid(group, material, position, scale) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material);
    mesh.position.set(...position); mesh.scale.set(...scale); group.add(mesh);
  }
  ellipsoid(alive, cream, [0, .4, 0], [.3, .23, .38]);
  ellipsoid(alive, pale, [0, .45, .35], [.13, .16, .16]);
  for (const x of [-.15, .15]) for (const z of [-.22, .22]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .23, 6), dark);
    leg.position.set(x, .115, z); alive.add(leg);
  }
  for (const x of [-.17, .17]) ellipsoid(alive, pale, [x, .5, .33], [.08, .025, .04]);
  // A low neutral food-cache marker, not an invented carcass sprite or live sheep.
  ellipsoid(carcass, pale, [0, .055, 0], [.32, .055, .38]);
  const mark = new THREE.Mesh(new THREE.RingGeometry(.27, .31, 20),
    new THREE.MeshBasicMaterial({ color: 0xa48355, side: THREE.DoubleSide }));
  mark.rotation.x = -Math.PI / 2; mark.position.y = .012; carcass.add(mark);
  return { alive, carcass };
}

export function createNeutralWildlifeRenderer({
  THREE, scene, groundHeight,
  loadArt = options => createStaticSheepRuntime(options),
}) {
  const records = new Map();
  const templateScene = new THREE.Scene();
  let template = null, artPromise = null, disposed = false;
  let artStatus = 'not-requested';
  function removeRecords() {
    for (const record of records.values()) {
      scene.remove(record.group);
      const geometries = new Set(), materials = new Set();
      for (const fallback of [record.alive, record.carcass]) fallback.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
    records.clear();
  }
  function ensureArt() {
    if (artPromise || !records.size) return;
    artStatus = 'loading';
    artPromise = Promise.resolve().then(() => loadArt({
      THREE, scene: templateScene,
      bindingUrl: WILDLIFE_RENDER_REGISTRY['bellweather-sheep'].bindingUrl,
    })).then(result => {
      if (disposed) { result.dispose(); return; }
      template = result; artStatus = 'ready';
    }).catch(() => { artStatus = 'fallback'; });
  }
  function reset(definitions = []) {
    removeRecords();
    if (disposed) return;
    const counts = new Map();
    for (const definition of definitions) counts.set(definition?.id, (counts.get(definition?.id) || 0) + 1);
    for (const definition of definitions) {
      if (!WILDLIFE_RENDER_REGISTRY[definition?.wildlifeSpecies]
        || counts.get(definition?.id) !== 1
        || typeof definition.id !== 'string' || !definition.id
        || !validWildlifeNodeDefinition(definition) || definition.type !== 'food'
        || !Number.isFinite(definition.x) || !Number.isFinite(definition.z)
        || !Number.isFinite(definition.stock) || definition.stock <= 0) continue;
      const group = new THREE.Group();
      const fallbacks = fallbackMeshes(THREE);
      group.add(fallbacks.alive, fallbacks.carcass); group.visible = false;
      group.userData.wildlifeNodeId = definition.id;
      scene.add(group);
      records.set(definition.id, {
        definition: { ...definition }, group, ...fallbacks,
        state: 'hidden', mode: 'hidden', art: null,
      });
    }
    ensureArt();
  }
  function reconcile(snapshots, isVisible = () => false) {
    const rows = new Map(), duplicate = new Set();
    for (const row of Array.isArray(snapshots) ? snapshots : []) {
      if (rows.has(row?.id)) duplicate.add(row.id);
      rows.set(row?.id, row);
    }
    for (const [id, record] of records) {
      record.state = duplicate.has(id) ? 'hidden'
        : wildlifePresentation(record.definition, rows.get(id), isVisible(record.definition));
      // Hide immediately on snapshot arrival, before the next render frame.
      record.group.visible = record.state === 'alive' || record.state === 'carcass';
      record.alive.visible = record.state === 'alive' && !template;
      record.carcass.visible = record.state === 'carcass';
      if (record.art) record.art.visible = record.state === 'alive' && Boolean(template);
      record.mode = record.state === 'alive' ? template ? 'static-illustration' : 'sheep-proxy'
        : record.state === 'carcass' ? 'food-cache-marker' : 'hidden';
    }
  }
  function update(camera) {
    if (disposed) return;
    for (const record of records.values()) {
      const { definition, group } = record;
      const y = groundHeight(definition.x, definition.z);
      if (!Number.isFinite(y)) { group.visible = false; continue; }
      group.position.set(definition.x, y, definition.z);
      if (record.state !== 'alive' || !template) continue;
      const shown = template.update({
        stateId: 'idle', directionId: 'north', moving: false, visible: true,
        x: 0, groundY: 0, z: 0,
      }, camera);
      if (!record.art && shown) {
        record.art = template.mesh.clone();
        group.add(record.art);
      }
      if (record.art) {
        record.art.visible = shown;
        record.art.position.copy(template.mesh.position);
        record.art.quaternion.copy(template.mesh.quaternion);
        record.art.scale.copy(template.mesh.scale);
      }
      record.alive.visible = !shown;
      record.mode = shown ? 'static-illustration' : 'sheep-proxy';
    }
  }
  return {
    reset, reconcile, update,
    isAvailable(id) {
      const record = records.get(id);
      return Boolean(record?.group.visible && ['alive', 'carcass'].includes(record.state));
    },
    diagnostics() {
      return { artStatus, nodes: [...records].map(([id, record]) => ({ id, state: record.state, mode: record.mode, visible: record.group.visible })) };
    },
    ready() { return artPromise || Promise.resolve(); },
    dispose() {
      disposed = true; removeRecords(); template?.dispose(); template = null;
    },
  };
}
