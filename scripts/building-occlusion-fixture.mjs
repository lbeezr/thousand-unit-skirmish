// Renderer-only QA fixture. It does not admit buildings into an authoritative match.
export const OCCLUSION_VIEWPORT = Object.freeze({ width: 1280, height: 720, baseFrustum: 43 });
export const OCCLUSION_STATES = Object.freeze(['complete', 'foundation', 'frame', 'damaged', 'critical']);

export function crowdedBuildingSpecs(count) {
  if (!Number.isInteger(count) || count < 1 || count > 129) throw new Error('Fixture count must be 1–129');
  const columns = count <= 32 ? 8 : 16, rows = Math.ceil(count / columns), spacing = 5.4;
  return Array.from({ length: count }, (_, i) => {
    const state = OCCLUSION_STATES[Math.floor(i / 4) % OCCLUSION_STATES.length];
    return { id: i, type: i % 2 ? 'archery-range' : 'barracks', team: Math.floor(i / 2) % 2,
      x: ((i % columns) - (columns - 1) / 2) * spacing,
      z: (Math.floor(i / columns) - (rows - 1) / 2) * spacing,
      progress: state === 'foundation' ? .05 : state === 'frame' ? .5 : 1,
      complete: !['foundation', 'frame'].includes(state),
      hp: state === 'critical' ? 300 : state === 'damaged' ? 900 : 1800, maxHp: 1800, state };
  });
}

export function detailBuildingSpecs() {
  return [
    { id: 0, type: 'barracks', team: 0, x: -5, z: -4, complete: true },
    { id: 1, type: 'archery-range', team: 1, x: 5, z: -4, complete: true },
    { id: 2, type: 'barracks', team: 1, x: -5, z: 4, progress: .05 },
    { id: 3, type: 'archery-range', team: 0, x: 5, z: 4, progress: .5 },
  ];
}

export function summarizeSamples(values) {
  if (!values.length) return null;
  if (values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid timing samples');
  const sorted = [...values].sort((a, b) => a - b);
  const at = fraction => sorted[Math.ceil(sorted.length * fraction) - 1];
  return { count: sorted.length, median: at(.5), p95: at(.95), min: sorted[0], max: sorted.at(-1) };
}
