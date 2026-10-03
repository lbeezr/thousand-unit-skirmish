import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { validateSpriteAtlas } from './sprite-atlas-contract.mjs';
import { decodeRgba8, measureFrameAlpha } from './sprite-pixel-bounds.mjs';

export const SHEEP_DIRECTIONS = Object.freeze([
  'north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west',
]);
const SCREEN_HEADINGS = ['down-left', 'down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left'];
const UNAVAILABLE = ['walk', 'graze', 'dispatch', 'carcass', 'depleted'];
const PUBLIC_SHA = '0ff688101304a7c10e181b3363ce767e8fb0082d0f754817edee81e04a9bf904';
// Immutable, already-public v1 derivatives; updated package hashes alone cannot
// establish that new pixels came from the approved illustrated reference.
const PUBLIC_SOURCE_SHA = '91819f5f48882040bbb2bce61371f8b499880094423288a8d61256c5a3713620';
const PUBLIC_RUNTIME_SHA = '35b9507f1ab20ffd1bdfd89be561da354f30641c5396949f2b82c9a98934d08b';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async filename => JSON.parse(await readFile(filename, 'utf8'));

// Producer metadata is checked separately from consumer bytes and visual review.
export function sheepCaptureContractErrors(contract) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const camera = contract?.camera;
  check(camera?.projection === 'orthographic' && same(camera.resolution, [512, 512]), 'capture requires orthographic 512px frames');
  check(same(camera?.root_pixel_from_upper_left, [256, 256])
    && camera?.projected_pixels_per_world_unit === 256, 'capture root/scale must be [256,256] and 256px/world unit');
  const position = camera?.runtime_position;
  const normalized = values => values?.map(value => value / Math.hypot(...values));
  const actual = Array.isArray(position) && position.length === 3 && position.every(Number.isFinite) ? normalized(position) : [];
  const expected = normalized(CAMERA_VIEW_DIRECTION);
  check(actual.length === 3 && actual.every((value, index) => Math.abs(value - expected[index]) < 1e-7)
    && same(camera?.look_at_runtime, [0, 0, 0]) && same(camera?.up_runtime, [0, 1, 0])
    && same(camera?.left_right_bottom_top, [-1, 1, -1, 1]) && camera?.roll_degrees === 0,
  'capture must use the existing fixed camera without crop/roll changes');
  check(contract?.runtimeConvention?.yaw_zero_nose === '+Z'
    && contract?.runtimeConvention?.positive_yaw === '+Z toward +X'
    && contract?.runtimeConvention?.runtime_up === '+Y', 'capture labels must describe runtime nose yaw');
  check(Number.isFinite(contract?.normalization?.face_vs_body_heading_degrees)
    && Math.abs(contract.normalization.face_vs_body_heading_degrees - 42.03499984741211) < 1e-6,
  'capture must preserve the recorded head/body offset');
  check(contract?.renderSettings?.transparent === true && contract.renderSettings.floor_in_color_frames === false
    && contract.renderSettings.contact_shadow_layer?.accepted === false
    && contract.renderSettings.contact_shadow_layer?.color_capture_shadows === false,
  'capture color frames must be transparent without floor or baked shadow');
  check(contract?.views?.length === 8, 'capture requires eight ordered views');
  for (const [index, direction] of SHEEP_DIRECTIONS.entries()) {
    const view = contract?.views?.[index];
    check(view?.filename === `sheep-yaw-${String(index * 45).padStart(3, '0')}.png`
      && view.world_yaw_degrees === index * 45 && view.clip_key === direction
      && view.screen_heading === SCREEN_HEADINGS[index], `${direction}: nose yaw/file/screen label mismatch`);
    check(same(view?.dimensions, [512, 512]) && same(view?.pivot_pixel_from_upper_left, [256, 256])
      && view?.clipped === false && view?.cropped === false && /^[a-f0-9]{64}$/.test(view?.sha256 || ''),
    `${direction}: missing source digest, canvas, root or unclipped declaration`);
  }
  return errors;
}

export function sheepPackMetadataErrors(manifest, binding, contract) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const directional = manifest?.packId === 'bellweather-sheep-static-v1';
  const fallback = manifest?.packId === 'bellweather-sheep-public-reference-v1';
  const directions = directional ? SHEEP_DIRECTIONS : ['north'];
  check(directional || fallback, 'unknown Sheep pack identity');
  check(binding?.packId === manifest?.packId && binding?.assetId === 'bellweather-sheep'
    && binding?.previewOnly === true && binding?.stateId === 'idle' && same(binding?.animations, [])
    && same(binding?.unavailableStates, UNAVAILABLE), 'binding must declare static idle only and absent action art');
  check(binding?.manifest === 'sprite-atlas-pack-v1.json', 'binding manifest must name the audited sprite-atlas-pack-v1.json');
  check(same(binding?.directions, directions), 'binding direction coverage does not match its source kind');
  check(binding?.cameraCalibrated === directional && binding?.noseYawOnly === directional
    && binding?.projectedPixelsPerWorldUnit === (directional ? 256 : 512), 'binding camera/nose/scale provenance mismatch');
  check(directional ? binding?.headBodyOffsetDegrees === contract?.normalization?.face_vs_body_heading_degrees
    : binding?.headBodyOffsetDegrees === null, 'head/body offset cannot be invented or applied twice');
  if (directional) errors.push(...sheepCaptureContractErrors(contract));
  const asset = manifest?.assets?.find(item => item.id === 'bellweather-sheep');
  check(asset?.kind === 'prop' && same(asset?.sortAnchorWorld, [0, 0, 0]), 'Sheep must keep its neutral ground anchor');
  if (directional) {
    const [low, high] = contract?.measurements?.full_geometry_bounds_world || [];
    check(same(asset?.artBoundsWorld, { min: low, max: high }) && asset?.heightWorld === high?.[1],
      'directional pack must preserve producer world bounds and common height');
  }
  const page = manifest?.pages?.[0];
  check(manifest?.pages?.length === 1 && page?.id === 'sheep-color'
    && same(page?.dimensionsPx, { width: directional ? 2048 : 512, height: directional ? 1024 : 512 })
    && page?.sampling?.generateMipmaps === false && page?.sampling?.uvInsetPx === .5
    && page?.sampling?.minFilter === 'linear' && page?.sampling?.magFilter === 'linear',
  'pack must keep its full-frame atlas and no-gutter sampling');
  check(asset?.clips?.length === directions.length && asset?.frames?.length === directions.length,
    'one independent frame and clip is required per declared direction');
  const used = new Set();
  for (const [index, direction] of directions.entries()) {
    const clips = asset?.clips?.filter(clip => clip.directionId === direction) || [];
    const clip = clips[0];
    check(clips.length === 1 && clip.stateId === 'idle' && clip.loop === false && clip.sequence?.length === 1,
      `${direction}: only one non-looping idle frame is admitted`);
    const frame = asset?.frames?.find(item => item.id === clip?.sequence?.[0]?.frameId);
    check(frame?.id === `idle-${direction}` && !used.has(frame?.id), `${direction}: missing or reused source frame`);
    used.add(frame?.id);
    const pivot = directional ? { x: 256, y: 256 } : { x: 670 * 512 / 1254, y: 1049 * 512 / 1254 };
    check(same(frame?.canvasPx, { width: 512, height: 512 }) && same(frame?.groundPivotPx, pivot)
      && ['unreviewed-estimate', 'reviewed'].includes(frame?.groundPivotStatus), `${direction}: canvas/root mismatch`);
    const rect = { x: (index % 4) * 512, y: Math.floor(index / 4) * 512, width: 512, height: 512 };
    check(frame?.fallbackRectPx?.pageId === 'sheep-color' && same(frame?.fallbackRectPx?.rectPx, rect)
      && frame?.frameRectsPx?.length === 1 && same(frame.frameRectsPx[0].rectPx, rect)
      && frame.frameRectsPx[0].pageId === 'sheep-color' && frame.frameRectsPx[0].layerId === 'actor'
      && same(frame.frameRectsPx[0].offsetPx, { x: 0, y: 0 }), `${direction}: frame crop/offset/atlas slot mismatch`);
  }
  return errors;
}

export async function auditSheepDirectionalReadiness(packDirectory, contractPath) {
  const root = path.resolve(packDirectory);
  const manifestPath = path.join(root, 'sprite-atlas-pack-v1.json');
  const [manifest, binding, contract, validation] = await Promise.all([
    json(manifestPath), json(path.join(root, 'static-preview-binding.json')), json(contractPath), validateSpriteAtlas(manifestPath),
  ]);
  const errors = [...validation.errors, ...sheepCaptureContractErrors(contract), ...sheepPackMetadataErrors(manifest, binding, contract)];
  if (sha(await readFile(manifestPath)) !== binding.manifestSha256) errors.push('binding manifest digest mismatch');
  const directional = manifest.packId === 'bellweather-sheep-static-v1';
  const asset = manifest.assets?.find(item => item.id === 'bellweather-sheep');
  let sourceViewsVerified = 0;
  try {
    if (validation.errors.length) throw new Error('atlas contract failed before source verification');
    const records = await json(path.join(root, 'source-records.json'));
    if (!records.originalViewsPreserved || records.records?.length !== binding.directions.length) errors.push('missing original source records');
    // Follow the same asset/page/file references as the runtime loader, rather
    // than validating an unused file with a conventional filename.
    const page = manifest.pages.find(item => item.id === asset.frames[0].fallbackRectPx.pageId);
    const sourceFile = manifest.files.find(item => item.id === page.sourceFileId);
    const runtimeFile = manifest.files.find(item => item.id === page.runtimeFileId);
    const sourceBytes = await readFile(path.join(root, sourceFile.path));
    const runtimeBytes = await readFile(path.join(root, runtimeFile.path));
    const source = decodeRgba8(sourceBytes), runtime = decodeRgba8(runtimeBytes);
    if (directional) {
      const consumed = await readFile(path.join(root, 'source/capture-contract.json'));
      if (sha(consumed) !== sha(await readFile(contractPath)) || sha(consumed) !== records.captureContract?.sha256
        || consumed.length !== records.captureContract?.bytes || binding.source !== 'source/capture-contract.json') {
        errors.push('consumed capture contract differs from the audited contract');
      }
      for (const [index, view] of contract.views.entries()) {
        const record = records.records[index];
        const bytes = await readFile(path.join(root, 'source', view.filename));
        if (record?.filename !== view.filename || record?.directionId !== view.clip_key
          || record?.sha256 !== view.sha256 || record?.bytes !== bytes.length || sha(bytes) !== view.sha256) {
          errors.push(`${view.clip_key}: original source digest/identity mismatch`); continue;
        }
        const image = decodeRgba8(bytes);
        if (image.width !== 512 || image.height !== 512) { errors.push(`${view.clip_key}: original canvas mismatch`); continue; }
        const box = measureFrameAlpha(image, { x: 0, y: 0, width: 512, height: 512 }, 1);
        if (!same([box.x, box.y, box.x + box.width, box.y + box.height], view.alpha_bbox_exclusive)) errors.push(`${view.clip_key}: original alpha bounds mismatch`);
        let nonzero = 0, minimum = 255, maximum = 0;
        for (let offset = 3; offset < image.pixels.length; offset += 4) {
          const alpha = image.pixels[offset];
          nonzero += alpha > 0; minimum = Math.min(minimum, alpha); maximum = Math.max(maximum, alpha);
        }
        if (minimum !== 0 || maximum !== 255 || nonzero !== view.nonzero_alpha_pixels
          || Math.min(box.x, box.y, 512 - box.x - box.width, 512 - box.y - box.height) < 2) {
          errors.push(`${view.clip_key}: transparency/count/margin mismatch`);
        }
        const frame = asset.frames.find(item => item.id === `idle-${view.clip_key}`);
        if (!same(frame.alphaBoundsPx, measureFrameAlpha(image, { x: 0, y: 0, width: 512, height: 512 }, 8))) {
          errors.push(`${view.clip_key}: declared frame alpha bounds mismatch`);
        }
        const rect = frame.fallbackRectPx.rectPx;
        let pixelsMatch = true;
        for (let y = 0; y < 512 && pixelsMatch; y++) for (let x = 0; x < 512 && pixelsMatch; x++) {
          const original = (y * 512 + x) * 4;
          const packed = ((rect.y + y) * source.width + rect.x + x) * 4;
          for (let channel = 0; channel < 4; channel++) {
            if (source.pixels[packed + channel] !== image.pixels[original + channel]
              || ((channel === 3 || image.pixels[original + 3] > 0)
                && runtime.pixels[packed + channel] !== image.pixels[original + channel])) pixelsMatch = false;
          }
        }
        if (!pixelsMatch) errors.push(`${view.clip_key}: atlas changed source pixels/alpha or mirrored a view`);
        else sourceViewsVerified++;
      }
    } else {
      const bytes = await readFile(path.join(root, 'source/sheep-model-input.png'));
      const record = records.records?.[0];
      if (sha(bytes) !== PUBLIC_SHA || record?.sha256 !== PUBLIC_SHA
        || record?.filename !== 'sheep-model-input.png' || record?.directionId !== 'north' || record?.bytes !== bytes.length) {
        errors.push('public fallback original digest/identity mismatch');
      } else sourceViewsVerified = 1;
      if (sha(sourceBytes) !== PUBLIC_SOURCE_SHA || sha(runtimeBytes) !== PUBLIC_RUNTIME_SHA) {
        errors.push('public fallback derived atlas differs from approved v1 pixels');
      }
      const frame = asset.frames.find(item => item.id === 'idle-north');
      for (const image of [source, runtime]) {
        if (!same(frame.alphaBoundsPx, measureFrameAlpha(image, frame.fallbackRectPx.rectPx, 8))) {
          errors.push('public fallback declared alpha bounds disagree with decoded pixels');
        }
      }
    }
  } catch (error) { errors.push('source bytes/records cannot be verified: ' + error.message); }
  return {
    packId: manifest.packId,
    status: errors.length ? 'invalid' : directional ? 'directional-static-bytes-validated' : 'public-static-fallback-validated',
    errors, sourceViewsVerified,
    declaredDirections: binding.directions,
    unavailableDirections: SHEEP_DIRECTIONS.filter(direction => !binding.directions.includes(direction)),
    animations: binding.animations,
    anchorReview: asset?.frames?.map(frame => ({ id: frame.id, status: frame.groundPivotStatus })),
    publicationApproval: 'not established by this check',
    visualAcceptance: 'separate owner-run review',
    liveDirectionalIntegration: false,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pack = process.argv[2] || 'assets/wildlife/bellweather-sheep-public-reference-v1';
  const contract = process.argv[3] || 'assets/wildlife/bellweather-sheep-public-reference-v1/cloud-capture-contract.json';
  if (process.argv.length > 4) throw new Error('Usage: node scripts/sheep-directional-readiness.mjs [PACK_DIRECTORY] [CAPTURE_CONTRACT]');
  const report = await auditSheepDirectionalReadiness(pack, contract);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
