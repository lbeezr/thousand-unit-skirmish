// One short centered selection gesture per existing building type. These are
// synthesized defaults, not recordings or accepted civilization voice assets.
const FREQUENCIES = Object.freeze({
  'palisade-wall': 293.66,
  'palisade-gate': 349.23,
  workshop: 392,
  stable: 440,
  watchtower: 880,
  'town-center': 587.33,
  storehouse: 329.63,
  mill: 493.88,
  farm: 523.25,
  dock: 698.46,
  house: 659.25,
  barracks: 783.99,
  'archery-range': 987.77,
});

export function buildingSelectionTone(buildingType) {
  const type = buildingType === 'townCenter' ? 'town-center'
    : buildingType === 'archeryRange' ? 'archery-range' : buildingType;
  if (!Object.hasOwn(FREQUENCIES, type)) return { frequency: 620, endFrequency: 780 };
  const frequency = FREQUENCIES[type];
  return { frequency, endFrequency: frequency * (780 / 620) };
}
