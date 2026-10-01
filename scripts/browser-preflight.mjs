// Browser startup evidence only; no match, screenshots, or graphics claims.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFortifiedBrowser} from './fortified-browser-fixture.mjs';

const issue = (code, message, nextStep) => ({code, message, nextStep});
export function diagnoseBrowserFailure(error) {
  const message = String(error?.message ?? error);
  const issues = [];
  if (/Chrome unavailable|Chrome was not found/i.test(message)) {
    issues.push(issue('browser-missing', 'Chrome/Chromium was not discovered.',
      'Use an installed browser and the existing CHROME_PATH setting.'));
  }
  if (/SUID sandbox helper|No usable sandbox|Failed to move to new namespace/i.test(message)) {
    issues.push(issue('sandbox-unavailable', 'The Linux browser sandbox could not start.',
      'Use a provider-provisioned runtime with a working browser sandbox.'));
  }
  if (/chrome_crashpad_handler: --database is required|cannot create.*(?:directory|profile)|Permission denied/i.test(message)
      || ['EACCES', 'EPERM', 'ENOENT'].includes(error?.code) && !error?.syscall?.startsWith('spawn')) {
    issues.push(issue('storage-unavailable', 'Browser profile/configuration storage could not be used.',
      'Provide writable per-job temporary, XDG configuration, and cache directories.'));
  }
  if (error?.syscall?.startsWith('spawn')) {
    issues.push(issue('browser-executable', 'The configured browser executable could not start.',
      'Check the installed executable path and runtime prerequisites.'));
  }
  if (!issues.length) {
    issues.push(/Chrome startup timeout/i.test(message)
      ? issue('startup-timeout', 'Chrome did not expose its local CDP endpoint in time.',
        'Inspect the provider browser startup log before attempting a capture.')
      : issue('startup-failed', 'Browser startup or CDP validation failed.',
        'Inspect the local startup log and verify the provider browser runtime.'));
  }
  // Fixed messages intentionally exclude raw browser stderr, paths, and environment values.
  return issues;
}

const report = () => ({schemaVersion: 1, scope: 'browser-startup', status: 'unsupported',
  browser: null, screenshots: 0, issues: []});

export function diagnoseBrowserLog(log) {
  return {...report(), issues: diagnoseBrowserFailure(log)};
}

export async function preflightBrowser({openBrowser = createFortifiedBrowser} = {}) {
  const result = report();
  let browser;
  try {
    browser = await openBrowser();
    if (typeof browser?.version?.product !== 'string' || !browser.version.product.trim()
        || typeof browser?.dispose !== 'function') throw new Error('Invalid CDP browser result');
    result.browser = {product: browser.version.product, protocolVersion: browser.version.protocolVersion ?? null};
    result.status = 'ready';
  } catch (error) {
    result.issues = diagnoseBrowserFailure(error);
  } finally {
    if (browser?.dispose) {
      try { await browser.dispose(); }
      catch {
        result.status = 'unsupported';
        result.issues.push(issue('cleanup-failed', 'Browser/profile cleanup failed.',
          'Resolve runtime cleanup before starting another browser job.'));
      }
    }
  }
  return result;
}

export async function runBrowserPreflight(args, {readLog = file => readFile(file, 'utf8'),
  openBrowser = createFortifiedBrowser, output = text => process.stdout.write(text),
  usage = text => process.stderr.write(text)} = {}) {
  if (args.length !== 1 || args[0] !== '--launch' && !/^--diagnose=.+$/.test(args[0])) {
    usage('Usage: node scripts/browser-preflight.mjs --launch | --diagnose=STARTUP_LOG\n');
    return 2;
  }
  let result;
  if (args[0] === '--launch') result = await preflightBrowser({openBrowser});
  else {
    try { result = diagnoseBrowserLog(await readLog(args[0].slice('--diagnose='.length))); }
    catch {
      result = {...report(), issues: [issue('log-unreadable', 'The startup log could not be read.',
        'Provide a readable local startup log; no browser was launched.')]};
    }
  }
  output(`${JSON.stringify(result, null, 2)}\n`);
  return result.status === 'ready' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runBrowserPreflight(process.argv.slice(2));
}
