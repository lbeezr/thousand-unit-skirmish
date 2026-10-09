// Keep game event routing independent of Web Audio and browser storage.
const ROLE_BY_KIND = Object.freeze({ worker: 'worker', infantry: 'infantry', archer: 'archer' });
const BUILDING_BY_TYPE = Object.freeze({ townCenter: 'town-center', 'town-center': 'town-center', barracks: 'barracks', archeryRange: 'archery-range', 'archery-range': 'archery-range' });
const URGENT_CUES = new Set(['battle-alert', 'selected-alert', 'base-alert', 'base-lost', 'objective', 'objective-lost', 'victory', 'defeat', 'draw']);
const WORKER_FOOD_JOBS = new Set(['farm', 'fish', 'sheep-carcass']);

// Compatibility entry; map validation stays independent of playback policy.
export { validateMapAudioReference } from './world/map-audio-reference.mjs';

export function bindingKeysForEvent({ cue, kind, buildingType, resource, gatherJob } = {}) {
  const keys = [];
  const building = BUILDING_BY_TYPE[buildingType] || (typeof buildingType === 'string' ? buildingType : null);
  const role = ROLE_BY_KIND[kind] || (typeof kind === 'string' ? kind : null);
  if (building && cue === 'select') keys.push(`building.${building}.select`);
  if (building && cue === 'building-complete') keys.push(`building.${building}.complete`);
  if (role && cue) {
    if (role === 'worker' && cue === 'gather' && resource === 'food' && WORKER_FOOD_JOBS.has(gatherJob)) {
      keys.push(`unit.worker.gather.${gatherJob}`);
    }
    if (resource && ['gather', 'work'].includes(cue)) keys.push(`unit.${role}.${cue}.${resource}`);
    keys.push(`unit.${role}.${cue}`);
  }
  if (cue) keys.push(`cue.${cue}`);
  if (cue === 'ready') keys.push('cue.complete');
  return keys;
}

export function resolveEventBinding(profile, event) {
  const civilizationId = event?.civilizationId ?? 'frontier';
  const overrides = profile?.civilizationBindings;
  // Sparse overrides never replace the common layer. Missing/unknown identities
  // and events retain the existing exact building / role-resource / role / cue order.
  const layers = overrides && Object.hasOwn(overrides, civilizationId)
    ? [overrides[civilizationId], profile?.bindings] : [profile?.bindings];
  const keys = bindingKeysForEvent(event);
  for (const bindings of layers) {
    for (const key of keys) {
      const binding = bindings?.[key];
      if (binding?.variants?.length) return { key, binding };
    }
  }
  return null;
}

export function createProfileDecisionGate({ now = () => performance.now() } = {}) {
  const lastAt = new Map();
  const lastVariant = new Map();
  let lastSpeechAt = -Infinity;
  let lastSpeechPriority = -Infinity;
  let reason = null;
  return {
    choose(profile, event) {
      const resolved = resolveEventBinding(profile, event);
      reason = null;
      if (!resolved) { reason = 'unbound'; return null; }
      const { key, binding } = resolved;
      const at = now();
      const urgent = URGENT_CUES.has(event.cue);
      const priority = Number.isFinite(binding.priority) ? binding.priority : urgent ? 10 : 0;
      const cooldown = Number.isFinite(binding.cooldownMs) ? binding.cooldownMs : 450;
      if (at - (lastAt.get(key) ?? -Infinity) < cooldown) { reason = 'binding cooldown'; return null; }
      if (binding.bus === 'voice' && !urgent && at - lastSpeechAt < 1250 && priority <= lastSpeechPriority) { reason = 'speech cooldown'; return null; }
      const variants = binding.variants;
      const previous = lastVariant.get(key);
      const eligible = variants.length > 1 ? variants.filter((variant) => variant.sourceId !== previous) : variants;
      const choices = eligible.length ? eligible : variants;
      const variant = choices[Math.floor(Math.random() * choices.length)];
      lastAt.set(key, at);
      lastVariant.set(key, variant.sourceId);
      if (binding.bus === 'voice') {
        lastSpeechAt = at;
        lastSpeechPriority = priority;
      }
      return { key, binding, variant };
    },
    getReason: () => reason,
    reset() { lastAt.clear(); lastVariant.clear(); lastSpeechAt = -Infinity; lastSpeechPriority = -Infinity; },
  };
}
