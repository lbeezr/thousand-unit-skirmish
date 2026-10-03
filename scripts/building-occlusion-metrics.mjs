// Optional native WebGL2 elapsed-time queries. CPU submission time is reported separately.
export function readGpuIdentity(gl, userAgent) {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const identity = { webglVersion: gl.getParameter(gl.VERSION), vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
    renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), unmaskedRendererAvailable: Boolean(debug), userAgent };
  identity.software = /swiftshader|llvmpipe|softpipe|software/i.test(identity.renderer);
  identity.hardwareIdentified = Boolean(debug) && !identity.software
    && /ANGLE.*Metal|Apple.*(?:M\d|GPU)|NVIDIA|AMD|Intel|Adreno|Mali|PowerVR/i.test(identity.renderer);
  return identity;
}

export function createGpuSampler(gl) {
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const available = Boolean(extension && gl.getQuery(extension.TIME_ELAPSED_EXT, extension.QUERY_COUNTER_BITS_EXT) > 0);
  const pending = [], values = [];
  let dropped = 0, invalidated = 0, active = null;
  return {
    available, values,
    get dropped() { return dropped; },
    get invalidated() { return invalidated; },
    get pendingCount() { return pending.length; },
    begin() {
      if (!available) return;
      active = gl.createQuery();
      if (!active) { dropped++; return; }
      gl.beginQuery(extension.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(active); active = null;
    },
    poll() {
      if (!available) return;
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        invalidated += values.length + pending.length;
        values.length = 0;
        for (const query of pending) gl.deleteQuery(query);
        pending.length = 0; return;
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const query = pending[i];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
        const nanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT);
        if (Number.isFinite(nanoseconds) && nanoseconds >= 0) values.push(nanoseconds / 1e6);
        else dropped++;
        gl.deleteQuery(query); pending.splice(i, 1);
      }
    },
    dispose() {
      if (active) { gl.endQuery(extension.TIME_ELAPSED_EXT); gl.deleteQuery(active); active = null; dropped++; }
      dropped += pending.length;
      for (const query of pending) gl.deleteQuery(query);
      pending.length = 0;
    },
  };
}
