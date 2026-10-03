export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SESSION_STORAGE_PREFIX = 'thousand-unit-skirmish-session:';
export const LAST_ROOM_STORAGE_KEY = 'thousand-unit-skirmish-last-room';

export function savedRoomSession(storage) {
  try {
    const last = storage?.getItem(LAST_ROOM_STORAGE_KEY);
    const room = ROOM_ID_PATTERN.test(last || '') ? last : 'default';
    const token = storage?.getItem(`${SESSION_STORAGE_PREFIX}${room}`);
    return SESSION_TOKEN_PATTERN.test(token || '') ? { room, token } : null;
  } catch { return null; }
}

export function sessionStatusUrl(room) {
  return room === 'default' ? '/api/session' : `/api/session?room=${encodeURIComponent(room)}`;
}

export function roomEntryUrl(currentUrl, room, { resume = false, studio = false } = {}) {
  if (room !== 'default' && !ROOM_ID_PATTERN.test(room || '')) throw new TypeError('Invalid room code.');
  const url = new URL('/', currentUrl);
  if (room !== 'default') url.searchParams.set('room', room);
  if (resume) url.searchParams.set('resume', '1');
  if (studio) url.searchParams.set('studio', '1');
  return url;
}

export function inviteRoomId(value, currentUrl) {
  const input = String(value || '').trim();
  if (ROOM_ID_PATTERN.test(input)) return input;
  const url = new URL(input, currentUrl);
  if (url.origin !== new URL(currentUrl).origin || !ROOM_ID_PATTERN.test(url.searchParams.get('room') || '')) {
    throw new TypeError('Use a valid room code or an invite from this game server.');
  }
  return url.searchParams.get('room');
}

// Existing authored rendering links remain deliberate game entry points.
const RENDER_LINKS = ['rendererCapture', 'workerSpritePreview', 'unitSpritePreview',
  'meshyInfantrySpritePreview', 'humanVaeloraPreview', 'humanAnimationPreview',
  'humanRosterPreview', 'castPreview', 'frontierBuildingsPreview'];
export function isGameEntry(url) {
  const query = new URL(url).searchParams;
  return query.has('room') || query.get('resume') === '1' || query.get('play') === '1'
    || RENDER_LINKS.some(key => query.has(key));
}
