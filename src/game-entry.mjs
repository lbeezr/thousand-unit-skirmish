import { createPveRoomUrl, mountPveEntry, pveEntryCapability } from './pve-entry.mjs';
import { createNavigationSettings } from './navigation-settings.mjs';
import { readAudioSettings } from './audio.mjs';
import { createPracticeEntryControls } from './practice-entry-controls.mjs';
import { savedRoomSession, sessionStatusUrl, roomEntryUrl, inviteRoomId, isGameEntry, ROOM_ID_PATTERN, requireEntryAuthentication } from './game-entry-session.mjs';

export async function bootGameEntry({ win = window, fetchImpl = (...args) => win.fetch(...args),
  navigate = url => win.location.assign(url), loadGame = async () => {
    await import('./main.js');
    mountPveEntry();
  } } = {}) {
  const doc = win.document;
  if (isGameEntry(win.location.href)) {
    doc.documentElement.dataset.entry = 'game';
    await loadGame();
    return null;
  }
  doc.documentElement.dataset.entry = 'menu';
  const root = doc.querySelector('#game-menu');
  const status = root.querySelector('#game-menu-status');
  const resume = root.querySelector('#menu-resume');
  const creationButtons = [...root.querySelectorAll('[data-create-game]')];
  const practiceControls = createPracticeEntryControls({ root: root.querySelector('#practice-mode-setup'), onChange: controls });
  let practiceSetup = null;
  let pve = pveEntryCapability(null);
  const join = root.querySelector('#menu-join');
  const joinDialog = doc.querySelector('#menu-join-dialog');
  const settingsDialog = doc.querySelector('#menu-settings-dialog');
  let busy = false, enabled = false, candidate = null, checkRevision = 0, intentRevision = 0, joinActive = false;
  let sessionStorage = null, localStorage = null;
  try { sessionStorage = win.sessionStorage; } catch {}
  try { localStorage = win.localStorage; } catch {}
  let navigation = createNavigationSettings(localStorage);
  function controls() {
    for (const button of [...creationButtons, join]) button.disabled = busy || !enabled;
    const newGame = root.querySelector('#menu-new-game');
    newGame.disabled ||= !pve.available;
    newGame.querySelector('span').textContent = pve.reason || pve.description;
    newGame.title = pve.reason || pve.description;
    practiceControls.update(practiceSetup, enabled, busy);
    root.querySelector('#menu-practice').disabled ||= !practiceControls.supported;
    root.querySelector('#menu-practice span').textContent = practiceControls.selectedLabel
      ? `${practiceControls.selectedLabel} · compatible maps · one player, no AI commander`
      : 'All maps, including labs · one player, no AI commander';
    resume.disabled = busy || !candidate;
    resume.hidden = !candidate;
  }
  function message(text = '') { status.textContent = text; }
  async function checkSession(value) {
    const response = await fetchImpl(sessionStatusUrl(value.room), {
      headers: { 'x-rts-resume-token': value.token }, cache: 'no-store',
    });
    requireEntryAuthentication(response);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error('Cannot check your saved session. Try again.');
    return (await response.json()).valid === true;
  }
  async function refresh() {
    const revision = ++checkRevision;
    intentRevision++;
    const saved = savedRoomSession(sessionStorage);
    candidate = candidate && saved && candidate.room === saved.room && candidate.token === saved.token ? candidate : null;
    busy = false; controls(); message();
    let nextEnabled = false, authenticationRequired = false;
    let failure = 'Room service is unavailable. Try reloading this page.';
    try {
      const response = await fetchImpl('/api/rooms/status', { cache: 'no-store' });
      requireEntryAuthentication(response);
      const service = response.ok ? await response.json() : null;
      nextEnabled = service?.enabled === true;
      if (revision === checkRevision) {
        practiceSetup = service?.practiceSetup || null;
        pve = pveEntryCapability(service?.ordinarySetup?.pve, practiceSetup);
      }
    } catch (error) {
      if (error.status === 401) { authenticationRequired = true; failure = error.message; }
    }
    if (revision !== checkRevision) return;
    enabled = nextEnabled;
    if (!enabled) message(failure);
    controls();
    if (saved && !authenticationRequired) {
      try {
        const valid = await checkSession(saved);
        if (revision === checkRevision) candidate = valid ? saved : null;
      }
      catch (error) { if (revision === checkRevision) message(error.message || 'Cannot check your saved session. Try again.'); }
      if (revision === checkRevision) controls();
    }
  }
  async function create(mode) {
    if (busy || !enabled || (mode === 'pve' && !pve.available)
      || (mode === 'practice' && !practiceControls.supported)) return;
    const intent = ++intentRevision;
    const focused = root.contains(doc.activeElement) ? doc.activeElement : null;
    busy = true; controls(); message('Creating a fresh room…');
    try {
      const options = mode === 'pve' ? { mode: 'pve' } : { mode: 'pvp',
        ...(mode === 'pvp' ? { pregame: true } : {}), ...(mode === 'practice' ? { practice: true, ...practiceControls.launchOptions } : {}) };
      const response = await fetchImpl('/api/rooms', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(options), cache: 'no-store' });
      requireEntryAuthentication(response);
      const result = await response.json();
      if (intent !== intentRevision) return;
      if (!response.ok || !ROOM_ID_PATTERN.test(result.roomId || '')) throw new Error(result.error || 'Room creation failed.');
      const target = mode === 'pve' ? createPveRoomUrl(new URL('/', win.location.href).href, result)
        : roomEntryUrl(win.location.href, result.roomId, { studio: mode === 'studio' });
      navigate(target.href);
    } catch (error) { if (intent === intentRevision) {
      busy = false; controls(); message(String(error?.message || 'Room creation failed.'));
      if (focused && !focused.disabled && !doc.querySelector('dialog[open]')
        && [doc.body, root, focused].includes(doc.activeElement)) focused.focus({ preventScroll: true });
    } }
  }
  for (const button of creationButtons) button.addEventListener('click', () => void create(button.dataset.createGame));
  resume.addEventListener('click', async () => {
    if (busy || !candidate) return;
    const intent = ++intentRevision, saved = candidate;
    busy = true; controls(); message('Checking your saved session…');
    try {
      const valid = await checkSession(saved);
      if (intent !== intentRevision) return;
      if (!valid) {
        candidate = null; busy = false; controls(); message('That session has expired. Create or join a room.'); return;
      }
      navigate(roomEntryUrl(win.location.href, saved.room, { resume: true }).href);
    } catch (error) { if (intent === intentRevision) { busy = false; controls(); message(error.message || 'Cannot check your saved session. Try again.'); } }
  });
  join.addEventListener('click', () => { joinActive = true; joinDialog.showModal(); joinDialog.querySelector('input').focus(); });
  joinDialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !joinDialog.open) return;
    const intent = ++intentRevision;
    const feedback = joinDialog.querySelector('[role=status]');
    try {
      const room = inviteRoomId(joinDialog.querySelector('input').value, win.location.href);
      busy = true; controls(); feedback.textContent = 'Checking the room…';
      const response = await fetchImpl(`/api/rooms/${room}`, { cache: 'no-store' });
      if (intent !== intentRevision || !joinDialog.open) return;
      requireEntryAuthentication(response);
      if (!response.ok) throw new Error(response.status === 404 ? 'Room expired or not found.' : 'Room service is unavailable.');
      navigate(roomEntryUrl(win.location.href, room).href);
    } catch (error) { if (intent === intentRevision) { busy = false; controls(); feedback.textContent = String(error.message); } }
  });
  function cancelJoin() {
    if (!joinActive) return;
    joinActive = false; intentRevision++; busy = false; controls();
  }
  joinDialog.querySelector('[data-close]').addEventListener('click', () => { cancelJoin(); joinDialog.close(); });
  joinDialog.addEventListener('cancel', cancelJoin);
  // Native close is queued; do not let an earlier close cancel a reopened dialog
  // or a fresh game action started after Cancel.
  joinDialog.addEventListener('close', () => { if (!joinDialog.open) cancelJoin(); });
  settingsDialog.querySelector('[data-close]').addEventListener('click', () => settingsDialog.close());
  const speed = settingsDialog.querySelector('#menu-camera-speed');
  const edge = settingsDialog.querySelector('#menu-edge-scroll');
  function showSettings() {
    navigation = createNavigationSettings(localStorage);
    speed.value = String(navigation.get().cameraSpeed * 100); edge.checked = navigation.get().edgeScrollEnabled;
    const audioSettings = readAudioSettings(localStorage);
    sound.checked = audioSettings.enabled; volume.value = String(audioSettings.volume * 100);
    settingsDialog.showModal();
  }
  root.querySelector('#menu-settings').addEventListener('click', showSettings);
  speed.addEventListener('input', () => navigation.set({ cameraSpeed: Number(speed.value) / 100 }));
  edge.addEventListener('change', () => navigation.set({ edgeScrollEnabled: edge.checked }));
  const sound = settingsDialog.querySelector('#menu-audio-enabled'), volume = settingsDialog.querySelector('#menu-audio-volume');
  function saveAudio() {
    try { localStorage?.setItem('tus-audio-v1', JSON.stringify({ ...readAudioSettings(localStorage), enabled: sound.checked, volume: Number(volume.value) / 100 })); } catch {}
  }
  sound.addEventListener('change', saveAudio); volume.addEventListener('input', saveAudio);
  // A server request can settle after page exit, before back-cache restoration.
  // It must not navigate or refresh the menu the player has already left.
  win.addEventListener('pagehide', () => { checkRevision++; intentRevision++; });
  win.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  win.markPrototypeReady?.();
  await refresh();
  if (doc.activeElement === doc.body) (creationButtons.find(button => !button.disabled)
    || root.querySelector('#menu-settings')).focus();
  return { refresh };
}

if (typeof window !== 'undefined') void bootGameEntry().catch(error => window.reportPrototypeError(error.message));
