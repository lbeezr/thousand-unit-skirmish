import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCHEMA_PATH = path.join(ROOT, 'schemas/painted-material-atlas-v1.schema.json');
const MATERIALS = [
  'meadow', 'short-grass', 'long-grass', 'forest-floor', 'dirt', 'sand', 'scree', 'cinder',
];
const PACK_ROOT = 'assets/environment/frontier-painted-material-atlas-v1';
const PAGE_SIZE = 1920;
const SLOT_SIZE = 640;
const MATERIAL_SIZE = 512;
const GUTTER = 64;
const MAX_MIP_LEVEL = 5;
const EXPECTED_FILE_IDS = [
  ...MATERIALS.map((name) => `source-${name}`),
  'atlas-source',
  ...Array.from({ length: MAX_MIP_LEVEL + 1 }, (_, level) => `atlas-mip-${level}`),
  'preview-sheet',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pointerValue(document, pointer) {
  return pointer.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], document);
}

function validateAgainstSchema(value, schema, rootSchema, pointer = '$', errors = []) {
  if (schema.$ref) {
    const referenced = pointerValue(rootSchema, schema.$ref);
    if (!referenced) errors.push(`${pointer}: schema reference ${schema.$ref} does not exist`);
    else validateAgainstSchema(value, referenced, rootSchema, pointer, errors);
    return errors;
  }
  if (schema.type === 'object') {
    if (!isObject(value)) {
      errors.push(`${pointer}: expected object`);
      return errors;
    }
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${pointer}.${key}: required property is missing`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.additionalProperties === false && !(key in (schema.properties || {}))) {
        errors.push(`${pointer}.${key}: additional property is not allowed`);
        continue;
      }
      if (schema.properties?.[key]) {
        validateAgainstSchema(child, schema.properties[key], rootSchema, `${pointer}.${key}`, errors);
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${pointer}: expected array`);
      return errors;
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${pointer}: expected at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${pointer}: expected at most ${schema.maxItems} items`);
    }
    if (schema.items) value.forEach((entry, index) => validateAgainstSchema(entry, schema.items, rootSchema, `${pointer}[${index}]`, errors));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') errors.push(`${pointer}: expected string`);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) errors.push(`${pointer}: expected integer`);
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${pointer}: expected finite number`);
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${pointer}: expected ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer}: value is outside the allowed set`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${pointer}: string is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${pointer}: string does not match the required pattern`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${pointer}: value is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${pointer}: value is above ${schema.maximum}`);
  }
  return errors;
}

function getPngMetadata(bytes) {
  if (bytes.length < 26 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('invalid PNG signature or truncated IHDR');
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG IHDR is not the first chunk');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes.readUInt8(24),
    colorType: bytes.readUInt8(25),
  };
}

function getWebpMetadata(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('invalid WebP RIFF header or truncated image');
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error(`truncated WebP ${chunk} chunk`);
    if (chunk === 'VP8L' && size >= 5 && bytes.readUInt8(start) === 0x2f) {
      const bits = bytes.readUInt32LE(start + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X' && size >= 10) {
      return {
        width: 1 + bytes.readUIntLE(start + 4, 3),
        height: 1 + bytes.readUIntLE(start + 7, 3),
      };
    }
    if (chunk === 'VP8 ' && size >= 10 && bytes[start + 3] === 0x9d
      && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) {
      return {
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    }
    offset = start + size + (size & 1);
  }
  throw new Error('WebP does not contain a supported VP8, VP8L, or VP8X image header');
}

function closeEnough(actual, expected) {
  return Number.isFinite(actual) && Math.abs(actual - expected) < 1e-12;
}

function equalRect(actual, expected) {
  return isObject(actual) && ['x', 'y', 'width', 'height'].every((key) => actual[key] === expected[key]);
}

export async function validatePaintedMaterialAtlas(manifestPath, manifestOverride) {
  const errors = [];
  const absoluteManifest = path.resolve(manifestPath);
  let manifest = manifestOverride;
  if (!manifest) {
    try {
      manifest = JSON.parse(await readFile(absoluteManifest, 'utf8'));
    } catch (error) {
      return { manifest: null, errors: [`cannot read manifest: ${error.message}`], verifiedFileCount: 0 };
    }
  }

  let schema;
  try {
    schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
    errors.push(...validateAgainstSchema(manifest, schema, schema));
  } catch (error) {
    errors.push(`cannot read or apply manifest schema: ${error.message}`);
    return { manifest, errors, verifiedFileCount: 0 };
  }
  if (!isObject(manifest)) return { manifest, errors, verifiedFileCount: 0 };

  const fileById = new Map();
  const fileByPath = new Map();
  for (const [index, entry] of (Array.isArray(manifest.files) ? manifest.files : []).entries()) {
    if (!isObject(entry)) continue;
    if (fileById.has(entry.id)) errors.push(`files[${index}]: duplicate file id ${entry.id}`);
    if (fileByPath.has(entry.path)) errors.push(`files[${index}]: duplicate file path ${entry.path}`);
    fileById.set(entry.id, entry);
    fileByPath.set(entry.path, entry);
  }

  const declaredIds = [...fileById.keys()].sort();
  if (JSON.stringify(declaredIds) !== JSON.stringify([...EXPECTED_FILE_IDS].sort())) {
    errors.push('files: must declare exactly eight ground sources, one source atlas, six runtime mips, and one preview');
  }
  const expectedFiles = new Map();
  for (const name of MATERIALS) {
    expectedFiles.set(`source-${name}`, {
      path: `assets/environment/frontier-v1/${name}.png`, usage: 'source', format: 'png',
    });
  }
  expectedFiles.set('atlas-source', { path: `${PACK_ROOT}/frontier-painted-material-atlas.png`, usage: 'source', format: 'png' });
  for (let level = 0; level <= MAX_MIP_LEVEL; level += 1) {
    expectedFiles.set(`atlas-mip-${level}`, {
      path: `${PACK_ROOT}/frontier-painted-material-atlas-mip-${level}.webp`, usage: 'runtime', format: 'webp',
    });
  }
  expectedFiles.set('preview-sheet', { path: `${PACK_ROOT}/preview.png`, usage: 'preview', format: 'png' });

  let verifiedFileCount = 0;
  const actualDimensions = new Map();
  for (const [id, expected] of expectedFiles) {
    const entry = fileById.get(id);
    if (!entry) {
      errors.push(`files: missing ${id}`);
      continue;
    }
    if (entry.path !== expected.path || entry.usage !== expected.usage || entry.format !== expected.format) {
      errors.push(`${id}: path, usage, and format must match the canonical atlas package`);
    }
    if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.includes('\\')
      || entry.path.split('/').includes('..')) {
      errors.push(`${id}: unsafe or non-canonical file path`);
      continue;
    }
    const target = path.resolve(ROOT, entry.path);
    if (!target.startsWith(`${ROOT}${path.sep}`)) {
      errors.push(`${id}: file resolves outside the repository`);
      continue;
    }
    try {
      const stat = await lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular non-symlink file');
      const bytes = await readFile(target);
      const actualHash = createHash('sha256').update(bytes).digest('hex');
      if (actualHash !== String(entry.sha256 || '').toLowerCase()) errors.push(`${id}: SHA-256 does not match its manifest entry`);
      const dimensions = entry.format === 'png' ? getPngMetadata(bytes) : getWebpMetadata(bytes);
      if (dimensions.width !== entry.dimensionsPx?.width || dimensions.height !== entry.dimensionsPx?.height) {
        errors.push(`${id}: image dimensions do not match its manifest entry`);
      }
      if (entry.format === 'png' && (dimensions.bitDepth !== 8 || dimensions.colorType !== 2)) {
        errors.push(`${id}: expected opaque 8-bit RGB PNG`);
      }
      actualDimensions.set(id, dimensions);
      verifiedFileCount += 1;
    } catch (error) {
      errors.push(`${id}: ${error.message}`);
    }
  }

  const layout = manifest.layout;
  if (isObject(layout)) {
    if (JSON.stringify(layout.order) !== JSON.stringify(MATERIALS)) errors.push('layout.order: expected the canonical row-major material order');
  }
  const page = manifest.page;
  if (isObject(page)) {
    if (page.sourceFileId !== 'atlas-source') errors.push('page.sourceFileId: must reference atlas-source');
    if (!equalRect({ x: 0, y: 0, width: page.dimensionsPx?.width, height: page.dimensionsPx?.height },
      { x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE })) errors.push(`page.dimensionsPx: expected ${PAGE_SIZE}x${PAGE_SIZE}`);
    if (page.gutterPx !== GUTTER || page.sampling?.maxMipLevel !== MAX_MIP_LEVEL) {
      errors.push('page: gutter and maximum mip level must match the versioned sampling contract');
    }
    if (!Array.isArray(page.mipLevels) || page.mipLevels.length !== MAX_MIP_LEVEL + 1) {
      errors.push('page.mipLevels: expected mip levels zero through five');
    } else {
      for (let level = 0; level <= MAX_MIP_LEVEL; level += 1) {
        const entry = page.mipLevels[level];
        const dimension = PAGE_SIZE >> level;
        if (entry?.level !== level || entry?.fileId !== `atlas-mip-${level}`
          || entry?.dimensionsPx?.width !== dimension || entry?.dimensionsPx?.height !== dimension) {
          errors.push(`page.mipLevels[${level}]: incorrect level, file reference, or dimensions`);
        }
        const file = fileById.get(`atlas-mip-${level}`);
        if (file && (file.dimensionsPx?.width !== dimension || file.dimensionsPx?.height !== dimension)) {
          errors.push(`atlas-mip-${level}: expected ${dimension}x${dimension}`);
        }
      }
    }
  }

  if (!Array.isArray(manifest.materials) || manifest.materials.length !== MATERIALS.length) {
    errors.push('materials: expected the eight canonical ground materials');
  } else {
    for (let index = 0; index < MATERIALS.length; index += 1) {
      const material = manifest.materials[index];
      const name = MATERIALS[index];
      const column = index % 3;
      const row = Math.floor(index / 3);
      const expectedSlot = { x: column * SLOT_SIZE, y: row * SLOT_SIZE, width: SLOT_SIZE, height: SLOT_SIZE };
      const expectedRect = {
        x: expectedSlot.x + GUTTER,
        y: expectedSlot.y + GUTTER,
        width: MATERIAL_SIZE,
        height: MATERIAL_SIZE,
      };
      if (material?.id !== name || material?.sourceFileId !== `source-${name}`) {
        errors.push(`materials[${index}]: expected ${name} linked to its matching source`);
      }
      if (!equalRect(material?.slotRectPx, expectedSlot) || !equalRect(material?.rectPx, expectedRect)) {
        errors.push(`${name}: slot and interior coordinates do not match the 3x3 guttered layout`);
      }
      const uv = material?.uvRectTopLeft;
      const expectedUv = {
        min: { u: (expectedRect.x + 0.5) / PAGE_SIZE, v: (expectedRect.y + 0.5) / PAGE_SIZE },
        max: {
          u: (expectedRect.x + MATERIAL_SIZE - 0.5) / PAGE_SIZE,
          v: (expectedRect.y + MATERIAL_SIZE - 0.5) / PAGE_SIZE,
        },
      };
      if (!closeEnough(uv?.min?.u, expectedUv.min.u) || !closeEnough(uv?.min?.v, expectedUv.min.v)
        || !closeEnough(uv?.max?.u, expectedUv.max.u) || !closeEnough(uv?.max?.v, expectedUv.max.v)) {
        errors.push(`${name}: UV rectangle must target the interior pixel centers with a half-pixel inset`);
      }
      if (material?.repeatMode !== 'mirrored-repeat' || material?.worldRepeatUnits !== 12) {
        errors.push(`${name}: expected mirrored-repeat sampling at a 12-world-unit period`);
      }
    }
  }

  return {
    manifest,
    errors,
    verifiedFileCount,
    allManifestHashesVerified: verifiedFileCount === EXPECTED_FILE_IDS.length && errors.length === 0,
    dimensions: Object.fromEntries(actualDimensions),
  };
}
