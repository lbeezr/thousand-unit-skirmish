// @ts-check

/**
 * Decide whether an extension header has an offer compatible with the server's
 * fixed deflate settings. The HTTP adapter supplies the raw header value.
 * @param {unknown} extensions
 * @returns {boolean}
 */
export function hasCompatiblePerMessageDeflateOffer(extensions) {
  if (typeof extensions !== 'string') return false;
  return extensions.split(',').some((offer) => {
    const [extensionName, ...parameters] = offer.split(';');
    if (extensionName.trim().toLowerCase() !== 'permessage-deflate') return false;
    const seen = new Set();
    for (const parameter of parameters) {
      const [rawName, rawValue] = parameter.trim().split('=', 2);
      const name = rawName.trim().toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      if (name === 'client_no_context_takeover' || name === 'server_no_context_takeover') {
        if (rawValue !== undefined) return false;
        continue;
      }
      if (name === 'client_max_window_bits') {
        if (rawValue !== undefined && !/^(?:8|9|1[0-5])$/.test(rawValue.trim())) return false;
        continue;
      }
      // The server uses the default 15-bit window and cannot honor a smaller server window.
      if (name === 'server_max_window_bits') return false;
      return false;
    }
    return true;
  });
}
