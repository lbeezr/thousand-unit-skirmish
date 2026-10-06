import { createAudioLibraryStore } from './client/audio/library-store.mjs';
import { mountAudioLibrary } from './audio-library-ui.mjs';

const container = document.getElementById('audio-studio');
mountAudioLibrary(container, { store: createAudioLibraryStore() });
