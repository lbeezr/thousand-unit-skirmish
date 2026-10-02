import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Stop only the child acquired by this invocation; wait before removing its data.
export async function stopChild(child, { graceMs = 8000 } = {}) {
  if (!child?.pid) return;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  // Descendants can hold inherited pipes after exit; closed streams mark safe disposal.
  if (exited() && child.stdio.every(stream => !stream || stream.closed)) return;
  await new Promise((resolve, reject) => {
    let timer;
    const finish = error => {
      clearTimeout(timer);
      child.off('close', closed); child.off('error', failed);
      if (error) reject(error); else resolve();
    };
    const closed = () => finish(), failed = error => finish(error);
    child.once('close', closed); child.once('error', failed);
    if (!exited()) {
      timer = setTimeout(() => { if (!exited()) child.kill('SIGKILL'); }, graceMs);
      child.kill('SIGTERM');
    }
  });
}

export async function startQaBrowser(prefix, executable, args, { temporaryRoot = os.tmpdir() } = {}) {
  const profile = await mkdtemp(path.join(temporaryRoot, prefix));
  let chrome;
  const dispose = async () => {
    await stopChild(chrome);
    await rm(profile, { recursive: true, force: true });
  };
  try {
    chrome = spawn(executable, [...args, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    await new Promise((resolve, reject) => {
      const started = () => { chrome.off('error', failed); resolve(); };
      const failed = error => { chrome.off('spawn', started); reject(error); };
      chrome.once('spawn', started); chrome.once('error', failed);
    });
    return { profile, chrome, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
