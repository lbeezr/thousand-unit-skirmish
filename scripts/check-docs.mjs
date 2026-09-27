import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Check repository Markdown offline, including historical records and asset READMEs.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = [...new Set(execFileSync('git', [
  'ls-files', '--cached', '--others', '--exclude-standard', '-z',
], { cwd: root, encoding: 'utf8' }).split('\0'))]
  .filter((file) => file.endsWith('.md') && existsSync(path.join(root, file)));
const cache = new Map();
const problems = [];
let linkCount = 0;

function document(file) {
  if (cache.has(file)) return cache.get(file);
  const raw = readFileSync(file, 'utf8');
  // Retain line numbers while excluding example Markdown inside fenced code.
  let fence = null;
  const text = raw.split('\n').map((line) => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
  const anchors = new Set();
  const counts = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '').replace(/ /g, '-');
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  for (const match of text.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g)) anchors.add(match[1]);
  const result = { text, anchors };
  cache.set(file, result);
  return result;
}

for (const relative of files) {
  const file = path.join(root, relative);
  const { text } = document(file);
  for (const match of text.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    linkCount++;
    const line = text.slice(0, match.index).split('\n').length;
    let decoded;
    try { decoded = decodeURIComponent(target); }
    catch { problems.push(`${relative}:${line}: invalid URL encoding: ${target}`); continue; }
    const hash = decoded.indexOf('#');
    const filename = hash < 0 ? decoded : decoded.slice(0, hash);
    const fragment = hash < 0 ? '' : decoded.slice(hash + 1);
    const resolved = filename ? path.resolve(path.dirname(file), filename) : file;
    if (!existsSync(resolved)) {
      problems.push(`${relative}:${line}: missing path: ${target}`);
    } else if (fragment && resolved.endsWith('.md') && statSync(resolved).isFile()
      && !document(resolved).anchors.has(fragment)) {
      problems.push(`${relative}:${line}: missing heading: ${target}`);
    }
  }
}

if (problems.length) {
  process.stderr.write(`${problems.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentation links passed: ${files.length} Markdown files, ${linkCount} local links.\n`);
}
