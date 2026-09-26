import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../schemas/sprite-atlas-pack-v1.schema.json', import.meta.url));

function isType(value, expected) {
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function checkSchema(value, schema, rootSchema, label = '$') {
  const issues = [];
  if (schema.$ref) {
    const name = schema.$ref.slice('#/$defs/'.length);
    return checkSchema(value, rootSchema.$defs[name], rootSchema, label);
  }
  if (schema.type && ![].concat(schema.type).some((type) => isType(value, type))) {
    issues.push(label + ' must be ' + [].concat(schema.type).join(' or '));
    return issues;
  }
  if (Object.hasOwn(schema, 'const') && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    issues.push(label + ' must equal ' + JSON.stringify(schema.const));
  }
  if (schema.enum && !schema.enum.includes(value)) issues.push(label + ' must be one of ' + schema.enum.join(', '));
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(label + ' is too short');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) issues.push(label + ' has an invalid format');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) issues.push(label + ' is below its minimum');
    if (schema.maximum !== undefined && value > schema.maximum) issues.push(label + ' exceeds its maximum');
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) issues.push(label + ' must be greater than ' + schema.exclusiveMinimum);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(label + ' has too few items');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push(label + ' has too many items');
    if (schema.items) value.forEach((entry, index) => issues.push(...checkSchema(entry, schema.items, rootSchema, `${label}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!Object.hasOwn(value, required)) issues.push(`${label}.${required} is required`);
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) issues.push(...checkSchema(value[key], childSchema, rootSchema, `${label}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`${label}.${key} is not allowed`);
    }
  }
  return issues;
}

function pngInfo(buffer) {
  if (buffer.length < 26 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a'
    || buffer.toString('ascii', 12, 16) !== 'IHDR' || buffer.readUInt32BE(8) !== 13) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) return null;
    if (kind === 'VP8X' && size >= 10) {
      return { width: 1 + buffer.readUIntLE(data + 4, 3), height: 1 + buffer.readUIntLE(data + 7, 3) };
    }
    if (kind === 'VP8L' && size >= 5 && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }
    if (kind === 'VP8 ' && size >= 10 && buffer[data + 3] === 0x9d
      && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

function sameDimensions(left, right) {
  return Boolean(left && right && left.width === right.width && left.height === right.height);
}

function insideRect(rect, dimensions) {
  return rect.x + rect.width <= dimensions.width && rect.y + rect.height <= dimensions.height;
}

function checkBounds(bounds, label, errors) {
  if (!bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max)) return;
  for (let axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(bounds.min[axis]) || !Number.isFinite(bounds.max[axis]) || bounds.min[axis] > bounds.max[axis]) {
      errors.push(`${label} has invalid min/max bounds on axis ${axis}`);
    }
  }
}

function uniqueIndex(items, label, errors) {
  const result = new Map();
  for (const item of items || []) {
    if (!item || typeof item.id !== 'string') continue;
    if (result.has(item.id)) errors.push(`duplicate ${label} id: ${item.id}`);
    else result.set(item.id, item);
  }
  return result;
}

function insidePack(root, actual) {
  const relative = path.relative(root, actual);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export async function validateSpriteAtlas(manifestPath) {
  const errors = [];
  const absoluteManifest = path.resolve(manifestPath);
  let manifest;
  let packRoot;
  let schema;
  try {
    [manifest, schema] = await Promise.all([
      readFile(absoluteManifest, 'utf8').then(JSON.parse),
      readFile(schemaPath, 'utf8').then(JSON.parse),
    ]);
    packRoot = await realpath(path.dirname(absoluteManifest));
  } catch (error) {
    return { manifest: null, packRoot: null, errors: ['cannot read sprite-atlas manifest or schema: ' + error.message] };
  }

  errors.push(...checkSchema(manifest, schema, schema));
  if (errors.length) return { manifest, packRoot, errors };

  const files = uniqueIndex(manifest.files, 'file', errors);
  const pages = uniqueIndex(manifest.pages, 'page', errors);
  const assetIds = new Set();
  const fileBytes = new Map();
  const filePaths = new Map();

  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || path.isAbsolute(file.path)) {
      errors.push(`file ${file.id} path must be relative to the pack directory`);
      continue;
    }
    const resolved = path.resolve(packRoot, file.path);
    if (!insidePack(packRoot, resolved)) {
      errors.push(`file ${file.id} path escapes the pack directory`);
      continue;
    }
    try {
      const actual = await realpath(resolved);
      if (!insidePack(packRoot, actual)) {
        errors.push(`file ${file.id} symlink escapes the pack directory`);
        continue;
      }
      const bytes = await readFile(actual);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest.toLowerCase() !== file.sha256.toLowerCase()) errors.push(`file ${file.id} SHA-256 mismatch`);
      const info = file.format === 'png' ? pngInfo(bytes) : webpDimensions(bytes);
      if (!info) {
        errors.push(`file ${file.id} is not a readable ${file.format.toUpperCase()} image`);
        continue;
      }
      if (!sameDimensions(info, file.dimensionsPx)) errors.push(`file ${file.id} decoded dimensions do not match its declaration`);
      if (file.format === 'png' && info.bitDepth !== 8) errors.push(`file ${file.id} PNG must use 8-bit channels`);
      if (file.usage === 'team-mask' && (file.format !== 'png' || info.bitDepth !== 8 || info.colorType !== 0)) {
        errors.push(`team mask ${file.id} must be an 8-bit grayscale PNG without alpha`);
      }
      fileBytes.set(file.id, info);
      filePaths.set(file.id, actual);
    } catch {
      errors.push(`missing or unreadable pack file: ${file.path}`);
    }
  }

  for (const page of manifest.pages) {
    const source = files.get(page.sourceFileId);
    const runtime = page.runtimeFileId ? files.get(page.runtimeFileId) : null;
    const mask = page.maskFileId ? files.get(page.maskFileId) : null;
    if (!source) errors.push(`page ${page.id} references missing source file ${page.sourceFileId}`);
    else if (source.usage !== 'source') errors.push(`page ${page.id} sourceFileId must reference a source file`);
    if (page.runtimeFileId && !runtime) errors.push(`page ${page.id} references missing runtime file ${page.runtimeFileId}`);
    else if (runtime && runtime.usage !== 'runtime') errors.push(`page ${page.id} runtimeFileId must reference a runtime file`);
    if (page.maskFileId && !mask) errors.push(`page ${page.id} references missing mask file ${page.maskFileId}`);
    else if (mask && mask.usage !== 'team-mask') errors.push(`page ${page.id} maskFileId must reference a team-mask file`);
    for (const fileId of [page.sourceFileId, page.runtimeFileId, page.maskFileId].filter(Boolean)) {
      const file = files.get(fileId);
      if (file && !sameDimensions(page.dimensionsPx, file.dimensionsPx)) errors.push(`page ${page.id} and file ${fileId} declarations use different dimensions`);
      const decoded = fileBytes.get(fileId);
      if (decoded && !sameDimensions(page.dimensionsPx, decoded)) errors.push(`page ${page.id} and file ${fileId} pixels use different dimensions`);
    }
    if (page.pixelFormat === 'rgba8' && page.alphaMode === 'opaque') errors.push(`page ${page.id} declares rgba8 with opaque alphaMode; use rgb8 or a transparent alphaMode`);
    if (page.alphaMode !== 'opaque' && page.pixelFormat !== 'rgba8') errors.push(`page ${page.id} needs rgba8 for ${page.alphaMode} alpha`);
    if ((page.alphaMode === 'opaque') !== (page.edgeRule === 'opaque')) errors.push(`page ${page.id} alphaMode and edgeRule disagree`);
    const sampling = page.sampling;
    if (sampling.uvInsetPx !== 0.5) errors.push(`page ${page.id} sampling.uvInsetPx must be exactly half a texel`);
    if (page.gutterRule === 'none' && page.gutterPx !== 0) errors.push(`page ${page.id} gutterRule none requires gutterPx 0`);
    if (page.gutterRule === 'edge-extended' && page.gutterPx < 1) errors.push(`page ${page.id} edge-extended requires a positive gutterPx`);
    if (!sampling.generateMipmaps && sampling.maxMipLevel !== 0) errors.push(`page ${page.id} sampling.maxMipLevel must be 0 when mipmaps are disabled`);
    if (sampling.generateMipmaps) {
      if (sampling.maxMipLevel < 1) errors.push(`page ${page.id} generated mipmaps need sampling.maxMipLevel >= 1`);
      if (page.gutterRule !== 'edge-extended') errors.push(`page ${page.id} generated mipmaps require edge-extended gutters`);
      const minimumGutter = 2 ** sampling.maxMipLevel;
      if (page.gutterPx < minimumGutter) errors.push(`page ${page.id} needs gutterPx >= ${minimumGutter} for sampling.maxMipLevel ${sampling.maxMipLevel}`);
      if (!sampling.minFilter.includes('mipmap')) errors.push(`page ${page.id} generated mipmaps need a mipmap minFilter`);
      const largestAvailableMip = Math.floor(Math.log2(Math.max(page.dimensionsPx.width, page.dimensionsPx.height)));
      if (sampling.maxMipLevel > largestAvailableMip) errors.push(`page ${page.id} sampling.maxMipLevel exceeds its image dimensions`);
    } else if (sampling.minFilter.includes('mipmap')) {
      errors.push(`page ${page.id} cannot select mip levels when mipmap generation is disabled`);
    }
    for (const fileId of [page.sourceFileId, page.runtimeFileId].filter(Boolean)) {
      const file = files.get(fileId);
      const info = fileBytes.get(fileId);
      if (!file || file.format !== 'png' || !info) continue;
      const expectedColorType = { rgba8: 6, rgb8: 2, gray8: 0 }[page.pixelFormat];
      if (info.colorType !== expectedColorType) errors.push(`page ${page.id} ${fileId} PNG channel layout does not match ${page.pixelFormat}`);
    }
  }

  for (const asset of manifest.assets) {
    if (assetIds.has(asset.id)) errors.push(`duplicate asset id: ${asset.id}`);
    assetIds.add(asset.id);
    checkBounds(asset.artBoundsWorld, `asset ${asset.id} artBoundsWorld`, errors);
    if (asset.cullingBoundsWorld) checkBounds(asset.cullingBoundsWorld, `asset ${asset.id} cullingBoundsWorld`, errors);
    if (asset.selectionBoundsWorld) checkBounds(asset.selectionBoundsWorld, `asset ${asset.id} selectionBoundsWorld`, errors);

    const layers = new Map();
    for (const layer of asset.layers || []) {
      if (layers.has(layer.id)) errors.push(`asset ${asset.id} has duplicate layer id ${layer.id}`);
      else layers.set(layer.id, layer);
    }
    const frames = uniqueIndex(asset.frames, `frame in ${asset.id}`, errors);
    for (const frame of asset.frames) {
      const canvas = frame.canvasPx;
      const pivot = frame.groundPivotPx;
      if (pivot.x > canvas.width || pivot.y > canvas.height) errors.push(`asset ${asset.id} frame ${frame.id} groundPivotPx is outside canvasPx`);
      if (frame.alphaBoundsPx && !insideRect(frame.alphaBoundsPx, canvas)) errors.push(`asset ${asset.id} frame ${frame.id} alphaBoundsPx is outside canvasPx`);

      const fallbackPage = pages.get(frame.fallbackRectPx.pageId);
      const fallbackRect = frame.fallbackRectPx.rectPx;
      if (!fallbackPage) errors.push(`asset ${asset.id} frame ${frame.id} references missing fallback page ${frame.fallbackRectPx.pageId}`);
      else {
        if (!insideRect(fallbackRect, fallbackPage.dimensionsPx)) errors.push(`asset ${asset.id} frame ${frame.id} fallbackRectPx is outside page ${fallbackPage.id}`);
        if (fallbackRect.width !== canvas.width || fallbackRect.height !== canvas.height) errors.push(`asset ${asset.id} frame ${frame.id} fallbackRectPx must match canvasPx dimensions`);
        if (fallbackRect.width <= 2 * fallbackPage.sampling.uvInsetPx || fallbackRect.height <= 2 * fallbackPage.sampling.uvInsetPx) errors.push(`asset ${asset.id} frame ${frame.id} fallbackRectPx is too small for the declared UV inset`);
      }

      const usedLayers = new Set();
      for (const frameRect of frame.frameRectsPx || []) {
        if (usedLayers.has(frameRect.layerId)) errors.push(`asset ${asset.id} frame ${frame.id} repeats layer ${frameRect.layerId}`);
        usedLayers.add(frameRect.layerId);
        if (!layers.has(frameRect.layerId)) errors.push(`asset ${asset.id} frame ${frame.id} references missing layer ${frameRect.layerId}`);
        const page = pages.get(frameRect.pageId);
        if (!page) {
          errors.push(`asset ${asset.id} frame ${frame.id} references missing page ${frameRect.pageId}`);
          continue;
        }
        if (!insideRect(frameRect.rectPx, page.dimensionsPx)) errors.push(`asset ${asset.id} frame ${frame.id} rectangle is outside page ${page.id}`);
        if (frameRect.rectPx.width <= 2 * page.sampling.uvInsetPx || frameRect.rectPx.height <= 2 * page.sampling.uvInsetPx) errors.push(`asset ${asset.id} frame ${frame.id} rectangle is too small for the declared UV inset`);
        if (frameRect.offsetPx.x + frameRect.rectPx.width > canvas.width
          || frameRect.offsetPx.y + frameRect.rectPx.height > canvas.height) {
          errors.push(`asset ${asset.id} frame ${frame.id} layer ${frameRect.layerId} exceeds canvasPx`);
        }
      }
    }

    const clipKeys = new Set();
    for (const clip of asset.clips) {
      const key = [clip.stateId, clip.directionId || '', clip.teamId || ''].join('\u0000');
      if (clipKeys.has(key)) errors.push(`asset ${asset.id} has duplicate clip state/direction/team: ${clip.stateId}/${clip.directionId || '*'}/${clip.teamId || '*'}`);
      clipKeys.add(key);
      for (const step of clip.sequence) {
        if (!frames.has(step.frameId)) errors.push(`asset ${asset.id} clip ${clip.stateId} references missing frame ${step.frameId}`);
      }
    }
  }

  return { manifest, packRoot, filePaths, errors };
}

/** Build a lossless, machine-readable handoff view from a successful validation. */
export function createSpriteAtlasHandoff(validation) {
  if (!validation?.manifest || !Array.isArray(validation.errors) || validation.errors.length > 0) {
    throw new Error('A valid sprite-atlas manifest is required to create a handoff report');
  }
  const { manifest } = validation;
  const filesById = new Map(manifest.files.map((file) => [file.id, file]));
  const verifiedFileIds = new Set(validation.filePaths?.keys?.() || []);
  const fileRecord = (fileId) => {
    if (!fileId) return null;
    const file = filesById.get(fileId);
    if (!file) return { id: fileId, missing: true };
    return {
      id: file.id,
      path: file.path,
      usage: file.usage,
      format: file.format,
      dimensionsPx: file.dimensionsPx,
      sha256: file.sha256.toLowerCase(),
      sha256Verified: verifiedFileIds.has(file.id),
    };
  };
  const pagesById = new Map(manifest.pages.map((page) => [page.id, page]));
  const pages = manifest.pages.map((page) => ({
    id: page.id,
    dimensionsPx: page.dimensionsPx,
    colorSpace: page.colorSpace,
    pixelFormat: page.pixelFormat,
    alphaMode: page.alphaMode,
    edgeRule: page.edgeRule,
    gutterPx: page.gutterPx,
    gutterRule: page.gutterRule,
    wrapMode: page.wrapMode,
    sampling: page.sampling,
    sourceFile: fileRecord(page.sourceFileId),
    runtimeFile: fileRecord(page.runtimeFileId),
    teamMaskFile: fileRecord(page.maskFileId),
  }));
  const assets = manifest.assets.map((asset) => {
    const layers = asset.layers || [];
    const layerById = new Map(layers.map((layer) => [layer.id, layer]));
    const frames = asset.frames.map((frame) => ({
      id: frame.id,
      canvasPx: frame.canvasPx,
      groundPivotPx: frame.groundPivotPx,
      groundPivotStatus: frame.groundPivotStatus,
      alphaBoundsPx: frame.alphaBoundsPx || null,
      fallbackRectPx: frame.fallbackRectPx,
      frameRectsPx: frame.frameRectsPx || [],
    }));
    const depthCrops = frames.flatMap((frame) => frame.frameRectsPx
      .filter((rect) => layerById.get(rect.layerId)?.drawLayer !== 'actor')
      .map((rect) => {
        const layer = layerById.get(rect.layerId);
        return {
          frameId: frame.id,
          layerId: rect.layerId,
          drawLayer: layer?.drawLayer || null,
          batchKey: layer?.batchKey || null,
          depthBiasWorld: layer?.depthBiasWorld ?? null,
          pageId: rect.pageId,
          rectPx: rect.rectPx,
          offsetPx: rect.offsetPx,
        };
      }));
    const unreviewedPivotFrameIds = frames
      .filter((frame) => frame.groundPivotStatus !== 'reviewed')
      .map((frame) => frame.id);
    const usedPageIds = new Set(frames.flatMap((frame) => [
      frame.fallbackRectPx.pageId,
      ...frame.frameRectsPx.map((rect) => rect.pageId),
    ]));
    const teamMaskPages = [...usedPageIds]
      .map((pageId) => pagesById.get(pageId))
      .filter((page) => page?.maskFileId)
      .map((page) => ({ pageId: page.id, file: fileRecord(page.maskFileId) }));
    const teamVariantIds = [...new Set(asset.clips.map((clip) => clip.teamId).filter(Boolean))];
    return {
      id: asset.id,
      kind: asset.kind,
      mapPlacement: {
        occupancyAuthority: 'map/gameplay data; this art manifest does not define occupied cells',
        recommendedTileFootprintHint: asset.recommendedTileFootprint || null,
        artBoundsWorld: asset.artBoundsWorld,
        heightWorld: asset.heightWorld,
        sortAnchorWorld: asset.sortAnchorWorld || null,
        cullingBoundsWorld: asset.cullingBoundsWorld || null,
        selectionBoundsWorld: asset.selectionBoundsWorld || null,
      },
      layers,
      frames,
      clips: asset.clips.map((clip) => ({
        stateId: clip.stateId,
        directionId: clip.directionId || null,
        teamId: clip.teamId || null,
        loop: clip.loop,
        sequence: clip.sequence,
      })),
      teamCueEvidence: {
        maskPages: teamMaskPages,
        teamVariantIds,
      },
      depthCrops,
      review: {
        groundPivotsReviewed: unreviewedPivotFrameIds.length === 0,
        unreviewedPivotFrameIds,
      },
    };
  });
  const hashesVerified = manifest.files.every((file) => verifiedFileIds.has(file.id));
  return {
    reportVersion: 1,
    pack: {
      schemaVersion: manifest.schemaVersion,
      packId: manifest.packId,
      packVersion: manifest.packVersion,
      maturity: manifest.maturity,
      provenance: manifest.provenance,
    },
    integrity: {
      status: hashesVerified ? 'passed' : 'incomplete',
      declaredFileCount: manifest.files.length,
      verifiedFileCount: verifiedFileIds.size,
      allManifestHashesVerified: hashesVerified,
    },
    files: manifest.files.map((file) => fileRecord(file.id)),
    pages,
    assets,
    scopeLimit: 'Integrity and declared handoff metadata only; this report does not establish visual approval or renderer integration.',
  };
}
