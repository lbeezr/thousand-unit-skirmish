import { validWildlifeNodeDefinition, validWildlifeNodeState } from './wildlife-state.mjs';
import { validWildlifePosition } from './wildlife-motion.mjs';
import { createStaticSheepRuntime } from './sheep-static-preview.mjs';
import { authoredWildlifeBodyHeading, authoredWildlifeNoseHeading,
  legacyNoseHeadingFromBody, wildlifeDirection } from './wildlife-heading.mjs';

function staticPose(definition, snapshot) {
  const noseHeading = snapshot?.wildlifeHeading === undefined
    ? authoredWildlifeNoseHeading(definition) : legacyNoseHeadingFromBody(snapshot.wildlifeHeading);
  return { stateId: 'idle', directionId: wildlifeDirection(noseHeading),
    moving: false, visible: true };
}

// Existing static directions follow authoritative position/heading. Walk art is a separate binding.
export const WILDLIFE_RENDER_REGISTRY = Object.freeze({
  'bellweather-sheep': Object.freeze({
    alive: 'eight-view-static',
    aliveFallback: 'sheep-proxy',
    carcassFallback: 'food-cache-marker',
    depleted: 'hidden',
    bindingUrl: new URL('../assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json', import.meta.url).href,
  }),
});

function positionOnMap(point, map) {
  // Herded nodes can cross authored cells; use the same half-open map bounds as
  // authoritative cell admission instead of the original local grazing radius.
  return Number.isSafeInteger(map?.width) && map.width > 0
    && Number.isSafeInteger(map.height) && map.height > 0
    && Number.isSafeInteger(map.width * map.height)
    && Number.isFinite(point?.x) && Number.isFinite(point.z)
    && point.x >= -map.width / 2 && point.x < map.width / 2
    && point.z >= -map.height / 2 && point.z < map.height / 2;
}

export function wildlifePresentation(definition, snapshot, visible, mapDefinition) {
  if (visible !== true || !WILDLIFE_RENDER_REGISTRY[definition?.wildlifeSpecies]
    || typeof definition.id !== 'string' || !definition.id
    || !validWildlifeNodeDefinition(definition) || definition.type !== 'food'
    || !Number.isFinite(definition.x) || !Number.isFinite(definition.z)
    || !Number.isFinite(definition.stock) || definition.stock <= 0
    || snapshot?.id !== definition.id || snapshot.type !== definition.type
    || !Number.isFinite(snapshot.stock) || snapshot.stock < 0 || snapshot.stock > definition.stock
    || !validWildlifeNodeState(snapshot, definition)
    || (mapDefinition === undefined
      ? ((snapshot.x !== undefined || snapshot.z !== undefined) && !validWildlifePosition(snapshot, definition))
      : !positionOnMap(snapshot, mapDefinition))
    || (snapshot.wildlifeHeading !== undefined && (!Number.isFinite(snapshot.wildlifeHeading)
      || snapshot.wildlifeHeading < 0 || snapshot.wildlifeHeading >= Math.PI * 2))
    || (snapshot.wildlifeActivity !== undefined && !['idle', 'grazing', 'wandering'].includes(snapshot.wildlifeActivity))) return 'hidden';
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
  let template = null, artPromise = null, disposed = false, activeMap;
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
  function reset(definitions = [], mapDefinition) {
    removeRecords();
    if (disposed) return;
    activeMap = mapDefinition === undefined ? undefined : { width: mapDefinition?.width, height: mapDefinition?.height };
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
      fallbacks.alive.rotation.y = authoredWildlifeBodyHeading(definition);
      group.add(fallbacks.alive, fallbacks.carcass); group.visible = false;
      group.userData.wildlifeNodeId = definition.id;
      scene.add(group);
      records.set(definition.id, {
        definition: { ...definition }, group, ...fallbacks,
        state: 'hidden', mode: 'hidden', art: null, snapshot: null,
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
      const row = rows.get(id);
      const point = activeMap === undefined && row?.x === undefined && row?.z === undefined ? record.definition : row;
      record.state = duplicate.has(id) ? 'hidden'
        : wildlifePresentation(record.definition, row, true, activeMap);
      if (record.state !== 'hidden' && isVisible(point) !== true) record.state = 'hidden';
      record.snapshot = ['alive', 'carcass'].includes(record.state) ? { ...row } : null;
      // Hide immediately on snapshot arrival, before the next render frame.
      const artAvailable = record.state === 'alive' && Boolean(template?.supports(staticPose(record.definition, record.snapshot)));
      record.group.visible = record.state === 'alive' || record.state === 'carcass';
      record.alive.visible = record.state === 'alive' && !artAvailable;
      record.carcass.visible = record.state === 'carcass';
      if (record.art) record.art.visible = artAvailable;
      record.mode = record.state === 'alive' ? artAvailable ? 'static-illustration' : 'sheep-proxy'
        : record.state === 'carcass' ? 'food-cache-marker' : 'hidden';
    }
  }
  function update(camera) {
    if (disposed) return;
    for (const record of records.values()) {
      const { definition, group } = record;
      if (!record.snapshot) continue;
      const x = record.snapshot?.x ?? definition.x, z = record.snapshot?.z ?? definition.z;
      const y = groundHeight(x, z);
      if (!Number.isFinite(y)) { group.visible = false; continue; }
      group.position.set(x, y, z);
      record.alive.rotation.y = record.snapshot?.wildlifeHeading ?? authoredWildlifeBodyHeading(definition);
      if (record.state !== 'alive' || !template) continue;
      const shown = template.update({
        ...staticPose(definition, record.snapshot),
        x: 0, groundY: 0, z: 0,
      }, camera);
      if (!record.art && shown) {
        record.art = template.mesh.clone();
        group.add(record.art);
      }
      if (record.art) {
        record.art.geometry = template.mesh.geometry;
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
    positionFor(id) {
      const record = records.get(id);
      return record?.snapshot ? { x: record.snapshot.x ?? record.definition.x, z: record.snapshot.z ?? record.definition.z } : null;
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
