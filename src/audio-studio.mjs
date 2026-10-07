import { createAudioLibraryStore } from './client/audio/library-store.mjs';
import { mountAudioLibrary } from './client/audio/library-ui.mjs';

const container = document.getElementById('audio-studio');
mountAudioLibrary(container, { store: createAudioLibraryStore() });
