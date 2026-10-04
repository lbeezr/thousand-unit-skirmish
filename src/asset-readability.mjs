import { frontierBuildingManifestUrl } from './frontier-building-preview.mjs';

const INFANTRY_CONTRACT = 'docs/art-direction/human-roster-v1/infantry-production-contract.json';
const townManifestPath = () => `assets/${new URL(frontierBuildingManifestUrl('town-center')).pathname.split('/assets/').at(-1)}`;

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Read PR318's existing interface; its owner retains decoded coverage/timing checks.
export function productionReadabilityStatus(contract, manifest, runtimeVersion) {
  if (contract.assetId !== 'infantry' || contract.identity?.rebuildPolicy !== 'explicit-reviewed-revision'
    || contract.publication?.state !== 'existing-public-runtime-only'
    || contract.manifest !== 'assets/units/infantry-sprite-v3/sprite-atlas-pack-v1.json') {
    throw new Error('Expected the existing public Infantry production contract');
  }
  if (!manifest.assets?.some(asset => asset.id === contract.assetId)) {
    throw new Error('Production sidecar asset is missing from the existing manifest');
  }
  const base = contract.manifest.slice(0, contract.manifest.lastIndexOf('/') + 1);
  const pins = contract.identity.approvedRuntimeFiles;
  if (!pins?.length || pins.some(pin => !/^assets\/units\/infantry-sprite-v3\/[a-z-]+\.png$/.test(pin.path)
    || !/^[a-f0-9]{64}$/.test(pin.sha256 || '')
    || !manifest.files?.some(file => base + file.path === pin.path && file.sha256 === pin.sha256))) {
    throw new Error('Manifest differs from the existing approved runtime pins');
  }
  const required = contract.requiredStates.length * contract.requiredDirections.length;
  return { assetId: contract.assetId, runtimeVersion: contract.integration.runtimeVersion,
    defaultVersionMatches: runtimeVersion === contract.integration.runtimeVersion,
    requiredCells: required, declaredMissingCells: [...contract.missingSourceCells],
    declaredAuthoredCells: required - contract.missingSourceCells.length,
    style: { ...contract.identity.style }, provenanceVersion: contract.provenance.version,
    publication: contract.publication.state, timing: contract.timing,
    renderAcceptance: contract.renderAcceptance.status, readability: 'unverified' };
}

export function buildingReadabilityStatus({ manifest, observedManifest, observedManifestData, spriteVisible = false } = {}) {
  const available = new Set([manifest?.completeState?.state, ...(manifest?.states || []).map(state => state.state)].filter(Boolean));
  // Compare the camera, lifecycle and image inputs consumed by captured-building-art,
  // leaving descriptive status/limitations independent from the rendered binding.
  const renderedContract = data => {
    const state = value => value && ({ state: value.state, views: value.views?.map(view => ({
      index: view.index, azimuthDegrees: view.azimuthDegrees, path: view.path, sha256: view.sha256,
      teamMaskPath: view.teamMaskPath, teamMaskSha256: view.teamMaskSha256,
    })) });
    const camera = data?.camera;
    return JSON.stringify({ schema: data?.schema, asset: data?.asset,
      camera: camera && { projection: camera.projection, framePixels: camera.framePixels,
        pixelsPerWorldUnit: camera.pixelsPerWorldUnit, elevationDegrees: camera.elevationDegrees,
        azimuthDegrees: camera.azimuthDegrees, anchorPixelFromTopLeft: camera.anchorPixelFromTopLeft,
        background: camera.background },
      stateOrder: data?.stateOrder, stateMapping: data?.stateMapping,
      completeState: state(data?.completeState), states: data?.states?.map(state) });
  };
  return {
    defaultBinding: observedManifest === `/${townManifestPath()}` && Boolean(observedManifestData)
      && renderedContract(manifest) === renderedContract(observedManifestData),
    views: manifest?.completeState?.views?.length || 0,
    states: ['foundation', 'frame', 'complete', 'damaged', 'critical'].map(state => ({ state, authored: available.has(state) })),
    spriteVisible: Boolean(spriteVisible),
    productionContract: 'not-recorded', readability: 'unverified',
  };
}

// Called only by the existing game's explicit assetReadability=1 debug option.
// World art, terrain, fog, camera and HUD styling remain the normal consumers.
export function mountAssetReadability({ document, getObservation, focus, fetchImpl = globalThis.fetch }) {
  const root = document.createElement('aside');
  root.id = 'asset-readability';
  root.className = 'contextual-command-bar';
  root.setAttribute('aria-label', 'Runtime asset readability review');
  Object.assign(root.style, { position: 'absolute', top: '80px', bottom: 'auto', left: 'auto', right: '16px',
    width: '360px', maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 110px)', zIndex: '20', overflow: 'auto' });
  document.querySelector('#viewport').append(root);
  const text = (tag, value, parent = root) => {
    const element = document.createElement(tag); element.textContent = value; parent.append(element); return element;
  };
  text('strong', 'Runtime asset readability');
  text('p', 'Read-only catalog · actual battlefield and HUD · readability unverified');
  const button = (label, run) => {
    const element = text('button', label); element.type = 'button';
    element.addEventListener('click', run); return element;
  };
  let closed = false;
  button('Close review', () => { closed = true; root.remove(); });
  // Key releases must reach the game's held-key cleanup even after focus moves here.
  for (const event of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel', 'keydown']) {
    root.addEventListener(event, e => e.stopPropagation());
  }
  const town = text('section', '');
  text('h3', 'Town Center · current Complete family', town);
  const coverage = text('p', 'Loading existing adoption record…', town);
  text('p', 'Public captured pack; editable model private/local. No production-sidecar audit yet.', town);
  const normal = button('Find Town Center · normal 0.91', () => focus(0.91));
  const strategic = button('Find Town Center · strategic 0.48', () => focus(0.48));
  normal.disabled = strategic.disabled = true;
  const follow = text('section', '');
  text('h3', 'Follow · existing labelled glyph', follow);
  const iconStatus = text('p', 'Loading approved source…', follow);
  text('p', 'Original public project vector; source and runtime are the same SVG. No production sidecar/style-version record yet.', follow);
  const samples = text('div', '', follow);
  text('p', '16 / 20 / 24 CSS px, uncropped. 20 px is the live command size. Recognition, contrast and crop acceptance still require rendered review.', follow);
  const grayscale = button('Grayscale icon comparison', () => {
    const enabled = grayscale.getAttribute('aria-pressed') !== 'true';
    grayscale.setAttribute('aria-pressed', String(enabled));
    samples.style.filter = enabled ? 'grayscale(1)' : '';
  });
  grayscale.setAttribute('aria-pressed', 'false');
  grayscale.disabled = true;
  const foot = text('section', '');
  text('h3', 'Infantry · existing production pilot', foot);
  const footStatus = text('p', 'Loading the foot owner’s existing sidecar…', foot);
  const context = text('p', 'Waiting for ordinary game state…');
  let manifests, contract, footManifest, iconHash, error = null, loaded = false, lastUpdate = -Infinity, snapshot = null;
  const getJson = async path => {
    const response = await fetchImpl(`/${path}`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Catalog metadata returned HTTP ${response.status}`);
    return response.json();
  };
  const ready = (async () => {
    try {
      manifests = await Promise.all([getJson(townManifestPath()), getJson('assets/ui/icons/actions/manifest.json')]);
      const action = manifests[1].actions.find(row => row.id === 'follow');
      const source = action?.source;
      if (source !== 'assets/ui/icons/actions/follow.svg') throw new Error('Unexpected Follow source');
      const response = await fetchImpl(`/${source}`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Follow returned HTTP ${response.status}`);
      iconHash = await sha256(await response.arrayBuffer());
      const liveIcon = document.querySelector('[data-persistent-order="follow"] img');
      if (liveIcon?.getAttribute('src') !== `/${source}`) throw new Error('Live Follow binding differs from approval');
      if (closed) return;
      for (const size of [16, 20, 24]) {
        const sample = text('span', '', samples);
        sample.style.display = 'inline-flex'; sample.style.alignItems = 'center'; sample.style.gap = '5px'; sample.style.marginRight = '12px';
        const image = document.createElement('img');
        image.src = liveIcon.getAttribute('src'); image.alt = ''; image.width = image.height = size;
        image.style.width = image.style.height = `${size}px`; image.style.flex = 'none'; image.style.objectFit = 'contain';
        sample.append(image); text('span', `${action.label} ${size}`, sample);
      }
      iconStatus.textContent = `Default source matches · served SHA-256 ${iconHash.slice(0, 12)}… · readability unverified.`;
      grayscale.disabled = false; loaded = true;
      try {
        const sidecar = await getJson(INFANTRY_CONTRACT);
        if (sidecar.manifest !== 'assets/units/infantry-sprite-v3/sprite-atlas-pack-v1.json'
          || sidecar.publication?.state !== 'existing-public-runtime-only') throw new Error('Unsupported production sidecar scope');
        const manifest = await getJson(sidecar.manifest);
        productionReadabilityStatus(sidecar, manifest, null);
        for (const file of sidecar.identity.approvedRuntimeFiles) {
          const response = await fetchImpl(`/${file.path}`, { cache: 'force-cache' });
          if (!response.ok || await sha256(await response.arrayBuffer()) !== file.sha256) throw new Error('Served Infantry pixels differ from existing approval');
        }
        contract = sidecar; footManifest = manifest;
      } catch (e) { error = e.message; footStatus.textContent = `Production pilot unavailable: ${error}`; }
    } catch (error) {
      coverage.textContent = iconStatus.textContent = `Review blocked: ${error.message}`;
    }
  })();
  return {
    ready,
    update(now) {
      if (closed || !loaded || now - lastUpdate < 250) return;
      lastUpdate = now;
      const observation = getObservation();
      const building = buildingReadabilityStatus({ manifest: manifests[0],
        observedManifest: observation.manifestPath, observedManifestData: observation.manifest, spriteVisible: observation.spriteVisible });
      normal.disabled = strategic.disabled = !observation.point;
      const missing = building.states.filter(row => !row.authored).map(row => row.state).join(', ');
      coverage.textContent = `${building.views} directions · ${building.states.filter(row => row.authored).length}/5 matching states · missing ${missing}. `
        + (building.defaultBinding ? 'Live default manifest matches. ' : 'Waiting for matching live Town Center. ')
        + (building.spriteVisible ? 'Runtime reports sprite loaded/visible; pixels unverified.' : 'Runtime reports no new Complete sprite; absent, pending or fallback.');
      let production = null;
      if (contract) {
        production = productionReadabilityStatus(contract, footManifest, observation.footRuntimeVersion);
        footStatus.textContent = `Sidecar declares ${production.declaredAuthoredCells}/${production.requiredCells} source cells; ${production.declaredMissingCells.length} missing. `
          + `Style ${production.style.id} / ${production.style.version}; provenance ${production.provenanceVersion}; ${production.publication}. `
          + `${production.defaultVersionMatches ? 'Configured version matches' : 'Configured version differs or not observed'}; rendered acceptance ${production.renderAcceptance}. `
          + Object.entries(production.timing).map(([state, spec]) => `${state} ${spec.durationMs} ms`).join(' · ');
      }
      context.textContent = `Map ${observation.mapId || 'not loaded'} · zoom ${Number(observation.zoom).toFixed(2)} · ${observation.width}×${observation.height} CSS px · renderer ratio ${observation.dpr}. Normal runtime observations are not readability acceptance.`;
      snapshot = { schemaVersion: 1, mapId: observation.mapId, cameraZoom: observation.zoom,
        viewport: [observation.width, observation.height], rendererPixelRatio: observation.dpr,
        building, icon: { id: 'follow', sizes: [16, 20, 24], servedSha256: iconHash,
          productionContract: 'not-recorded', readability: 'unverified' }, production, error };
    },
    get snapshot() { return snapshot; },
    dispose() { closed = true; root.remove(); },
  };
}
