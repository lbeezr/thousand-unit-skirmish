// Procedural placeholder; two leaves stay inside a single cell in either state.
export function createGateTimbers(THREE, material) {
  const group = new THREE.Group(), leaves = [];
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), material);
    post.position.set(side * 0.4, 0.7, 0); group.add(post);
    const hinge = new THREE.Group(); hinge.position.x = side * 0.3;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.12), material);
    leaf.position.set(-side * 0.15, 0.65, 0); hinge.add(leaf); group.add(hinge);
    leaves.push({ hinge, side });
  }
  return { group, leaves };
}

export function updateGateTimbers(gate, building) {
  const northSouth = !building.connections?.some(direction => direction === 'east' || direction === 'west')
    && building.connections?.some(direction => direction === 'north' || direction === 'south');
  gate.group.rotation.y = northSouth ? Math.PI / 2 : 0;
  for (const { hinge, side } of gate.leaves) hinge.rotation.y = building.gateOpen ? side * Math.PI / 2 : 0;
}
