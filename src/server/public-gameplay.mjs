import { isClientStaticAsset } from './client-static-assets.mjs';

const ROOM_ID = '[A-Za-z0-9_-]{32}';
const ROOM_LOOKUP = new RegExp(`^/api/rooms/${ROOM_ID}$`);
const REVIEW_MODULES = new Set([
  'src/environment-review.mjs', 'src/studies/water/preview.mjs',
  'src/audio-zones.mjs',
]);

// Anonymous admission is separate from credential validation and default-denies
// new routes. The worker still checks sessions, seats, commands and static files.
export function isAnonymousGameplayRequest(method, url) {
  const pathname = url.pathname;
  if (method === 'POST') return pathname === '/api/rooms';
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (pathname === '/api/rooms/status' || ROOM_LOOKUP.test(pathname)
    || pathname === '/api/session') return method === 'GET';
  // Require canonical paths, so an encoded health/private path cannot acquire
  // static admission before the worker decodes it.
  if (pathname.includes('%') || pathname.startsWith('//')) return false;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (relative.endsWith('.html') && relative !== 'index.html') return false;
  if (REVIEW_MODULES.has(relative)) return false;
  return isClientStaticAsset(relative);
}
