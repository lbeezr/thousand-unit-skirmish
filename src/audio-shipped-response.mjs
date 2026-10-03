/**
 * Read shipped audio metadata or source bytes under the caller's existing limit.
 * Status, MIME, missing-body and size failures contain no response text or URL.
 * Transport/programmer failures retain their identity; a distinct cancellation
 * failure is retained alongside the primary failure rather than replacing it.
 * @param {Response} response
 * @param {number} limit Maximum accepted bytes, including streamed chunks.
 * @param {string} mime Expected MIME before any charset parameter.
 * @returns {Promise<Uint8Array>}
 */
export async function readBoundedAudioResponse(response, limit, mime) {
  if (!response.ok) throw new Error('Audio response status/MIME mismatch: request failed');
  if (response.headers.get('content-type')?.split(';')[0].trim() !== mime) {
    throw new Error('Audio response status/MIME mismatch: unexpected content type');
  }
  if (Number(response.headers.get('content-length')) > limit) {
    throw new RangeError('Audio response exceeds size limit');
  }
  if (!response.body) throw new Error('Audio response body is missing');

  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new RangeError('Audio response exceeds size limit');
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch (cleanupError) {
      // An errored stream commonly rejects cancel with its original read error.
      if (cleanupError !== error) {
        throw new AggregateError([error, cleanupError],
          'Audio response read failed and stream cancellation failed', { cause: error });
      }
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
