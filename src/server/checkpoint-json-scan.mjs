import { XL_CHECKPOINT_JSON_LIMITS as limits } from './checkpoint-json-budget.mjs';

// A bounded lexical volume/dimension inspector, not a JSON semantic parser.
// Full JSON.parse and the authority still validate every admitted snapshot.
// Only16 shallow frames and an80-character key prefix are retained, even for
// arbitrarily deep/large legacy files. Last duplicate map/dimension keys win.
export class CheckpointJsonScan {
  depth = 0;
  frames = [];
  token = null;
  string = null;
  definition = null;
  values = 0;
  containers = 0;
  maxDepth = 0;
  violation = null;
  rootObject = false;
  rootClosed = false;

  mark(reason) { this.violation ??= reason; }
  valueStart() {
    if (++this.values > limits.values) this.mark('exceeds value quota');
    const parent = this.frames[this.depth - 1];
    if (this.depth === 1 && parent?.key === 'mapDefinition') this.definition = null;
    const dimension = parent?.map && ['width', 'height'].includes(parent.key) ? parent.key : null;
    if (parent) {
      if (++parent.members > (parent.type === '[' ? limits.arrayEntries : limits.objectMembers))
        this.mark(parent.type === '[' ? 'exceeds array quota' : 'exceeds member quota');
      parent.expect = 'comma';
      if (dimension) parent[dimension] = null;
    }
    return { parent, dimension };
  }
  startString() {
    const frame = this.frames[this.depth - 1], key = frame?.type === '{' && frame.expect === 'key';
    if (!key) this.valueStart();
    this.string = { key, frame, captureKey: key && (this.depth === 1 || frame.map),
      prefix: '', truncated: false, units: 0, escape: false, unicode: 0 };
  }
  endString() {
    const s = this.string;
    if (s.key && s.frame) {
      let key = null;
      if (s.captureKey && !s.truncated) { try { key = JSON.parse(`"${s.prefix}"`); } catch { this.mark('malformed key string'); } }
      s.frame.key = key; s.frame.expect = 'colon';
      if (s.units > limits.objectMembers) this.mark('exceeds key quota');
    }
    this.string = null;
  }
  startToken(char) {
    const { parent, dimension } = this.valueStart();
    this.token = { parent, dimension, numeric: /[0-9-]/.test(char), units: 0,
      before: 0, digits: 0, first: -1, prefix: '', decimal: false,
      exponent: false, exponentNegative: false, exponentValue: 0, negative: false };
  }
  tokenChar(char) {
    const t = this.token;
    if (++t.units > limits.numberUnits) this.mark('exceeds scalar token quota');
    if (!t.dimension || !t.numeric) return;
    if (char === 'e' || char === 'E') { t.exponent = true; return; }
    if (char === '-') { if (t.exponent) t.exponentNegative = true; else t.negative = true; return; }
    if (char === '.') { t.decimal = true; return; }
    if (char < '0' || char > '9') return;
    if (t.exponent) { t.exponentValue = Math.min(Number.MAX_SAFE_INTEGER, t.exponentValue * 10 + Number(char)); return; }
    if (!t.decimal) t.before++;
    if (t.first < 0 && char !== '0') t.first = t.digits;
    if (t.first >= 0 && t.prefix.length < 20) t.prefix += char;
    t.digits++;
  }
  endToken() {
    const t = this.token;
    if (t.dimension && t.numeric) {
      // The20-significant-digit approximation is used only to distinguish
      // valid integer dimensions <=256 from >=257, with a half-unit margin.
      // It never accepts a map; JSON.parse + validateMapDefinition remain exact.
      const exponent = (t.exponentNegative ? -t.exponentValue : t.exponentValue)
        + t.before - t.first - t.prefix.length;
      const value = t.first < 0 ? 0 : Number(t.prefix) * 10 ** exponent;
      t.parent[t.dimension] = t.negative ? -value : value;
    }
    this.token = null;
  }
  push(text) {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (this.string) {
        const s = this.string;
        if (!s.escape && !s.unicode && c === '"') { this.endString(); continue; }
        if (s.captureKey && !s.truncated) { if (s.prefix.length < 80) s.prefix += c; else s.truncated = true; }
        if (s.unicode) { if (--s.unicode === 0) s.units++; }
        else if (s.escape) { s.escape = false; if (c === 'u') s.unicode = 4; else s.units++; }
        else if (c === '\\') s.escape = true;
        else s.units++;
        if (s.units > limits.stringUnits) this.mark('exceeds string quota');
        continue;
      }
      if (this.token) {
        if (!/[\s,}\]:]/.test(c)) { this.tokenChar(c); continue; }
        this.endToken();
      }
      if (/\s/.test(c)) continue;
      const parent = this.frames[this.depth - 1];
      if (c === '"') { this.startString(); continue; }
      if (c === '{' || c === '[') {
        const map = this.depth === 1 && parent?.type === '{' && parent.key === 'mapDefinition';
        this.valueStart();
        if (map) this.definition = null;
        this.depth++;
        if (++this.containers > limits.containers) this.mark('exceeds container quota');
        this.maxDepth = Math.max(this.maxDepth, this.depth);
        if (this.depth > limits.depth) this.mark('exceeds depth quota');
        else this.frames[this.depth - 1] = { type: c, expect: c === '{' ? 'key' : 'value',
          key: null, members: 0, map: map && c === '{', width: null, height: null };
        if (this.depth === 1) this.rootObject = c === '{';
      } else if (c === '}' || c === ']') {
        if (this.depth <= limits.depth) {
          if (parent?.map) this.definition = { width: parent.width, height: parent.height };
          this.frames.pop();
        }
        this.depth--;
        if (this.depth === 0) this.rootClosed = true;
      } else if (c === ',') { if (parent) { parent.expect = parent.type === '{' ? 'key' : 'value'; parent.key = null; } }
      else if (c === ':') { if (parent) parent.expect = 'value'; }
      else {
        if (this.depth === 1 && parent?.key === 'mapDefinition') this.definition = null;
        this.startToken(c); this.tokenChar(c);
      }
    }
  }
  finish() {
    if (this.token) this.endToken();
    const d = this.definition;
    return { legacyCandidate: this.rootObject && this.rootClosed && this.depth === 0 && !this.string
      && d?.width >= 15.5 && d.width < 256.5 && d.height >= 15.5 && d.height < 256.5,
    dimensionApproximation: d, values: this.values, containers: this.containers,
    maxDepth: this.maxDepth, violation: this.violation,
    scope: 'classification/volume only; exact JSON syntax and checkpoint semantics remain authoritative' };
  }
}
