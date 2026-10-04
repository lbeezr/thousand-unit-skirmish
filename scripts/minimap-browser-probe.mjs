// Read-only QA camera observation. A minimap outline is optional when its corner rays miss terrain.
export function installMinimapCameraProbe(THREE, capture) {
  const prototype = THREE.Raycaster.prototype;
  const original = prototype.setFromCamera;
  prototype.setFromCamera = function (coords, camera) {
    const result = original.call(this, coords, camera);
    if (camera.isOrthographicCamera) {
      capture.camera = {
        position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        zoom: camera.zoom, frustum: [camera.left, camera.right, camera.top, camera.bottom],
      };
      capture.cameraSamples = (capture.cameraSamples || 0) + 1;
    }
    return result;
  };
  return () => { prototype.setFromCamera = original; };
}
