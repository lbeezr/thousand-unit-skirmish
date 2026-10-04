// The presentation host supplies its existing root, loader and Three constants.
export async function fetchVerifiedRuntimeImage(path, entry, { assetRoot: INTERACTIVE_ASSET_ROOT, textureLoader, THREE }) {
  if (!entry || entry.role !== 'runtime-image'
    || !Number.isInteger(entry.dimensionsPx?.width) || entry.dimensionsPx.width <= 0
    || !Number.isInteger(entry.dimensionsPx?.height) || entry.dimensionsPx.height <= 0
    || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) {
    throw new Error(`Interactive environment manifest has an invalid runtime entry for ${path}`);
  }
  const response = await fetch(`${INTERACTIVE_ASSET_ROOT}${path}`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable for runtime asset verification');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actualSha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  if (actualSha256 !== entry.sha256.toLowerCase()) {
    throw new Error(`${path} SHA-256 differs from its manifest entry`);
  }
  const texture = await new Promise((resolve, reject) => {
    textureLoader.load(`${INTERACTIVE_ASSET_ROOT}${path}`, resolve, undefined, reject);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const image = texture.image;
  const dimensions = {
    width: image?.naturalWidth || image?.width || 0,
    height: image?.naturalHeight || image?.height || 0,
  };
  if (dimensions.width !== entry.dimensionsPx.width || dimensions.height !== entry.dimensionsPx.height) {
    texture.dispose();
    throw new Error(`${path} decoded as ${dimensions.width}x${dimensions.height}; manifest declares `
      + `${entry.dimensionsPx.width}x${entry.dimensionsPx.height}`);
  }
  return { texture, dimensions, sha256: actualSha256 };
}
