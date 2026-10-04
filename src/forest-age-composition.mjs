// Presentation only: retain every wood-cell root and resource owner.
/** @typedef {Readonly<{cell: number, x: number, z: number}>} CanopyPoint */

/**
 * @param {ReadonlyArray<CanopyPoint>} points
 * @param {number} [seed]
 * @param {number} [radius]
 * @returns {Map<number, number>} Factors keyed by the original wood-cell ID.
 */
export function forestAgeFactors(points, seed=0, radius=1.6) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Canopy spacing radius must be positive');
  /** @param {number} cell */
  const hash=cell=>{let n=(cell^Math.imul(seed|0,0x9e3779b1))>>>0;
    n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return(n^(n>>>15))>>>0;};
  const ranked=points.map(p=>({...p,rank:hash(p.cell)}));
  /** @type {Map<string, Array<CanopyPoint & {rank: number}>>} */
  const buckets=new Map();
  /** @param {number} x @param {number} z */
  const key=(x,z)=>`${Math.floor(x/radius)},${Math.floor(z/radius)}`;
  for(const p of ranked){const k=key(p.x,p.z),list=buckets.get(k)||[];list.push(p);buckets.set(k,list);}
  /** @type {Map<number, number>} */
  const factors=new Map();
  for(const p of ranked){
    const cx=Math.floor(p.x/radius),cz=Math.floor(p.z/radius);let mature=true;
    for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++)for(const q of buckets.get(`${x},${z}`)||[]) {
      if((q.rank<p.rank||(q.rank===p.rank&&q.cell<p.cell))&&Math.hypot(q.x-p.x,q.z-p.z)<radius)mature=false;
    }
    factors.set(p.cell,mature?1.05:.65+.15*hash(p.cell+7919)/0xffffffff);
  }
  return factors;
}

// Prepared pine pilot: caller supplies the immutable map seed and original wood
// cell, never stock, iteration order, time or a reconnect/session identifier.
// This selector is not bound to environment-art until the slot owner agrees the
// shared seam. Version 1 must retain its hash for existing saved map identities.
/** @param {number} cell @param {number} [seed] */
export function pineViewVariation(cell, seed=0) {
  if (![cell, seed].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) {
    throw new RangeError('Pine appearance requires unsigned 32-bit cell and map seed');
  }
  /** @param {number} salt */
  const sample = salt => {
    let n = (cell ^ Math.imul(seed, 0x9e3779b1) ^ salt) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
    return (n ^ (n >>> 15)) >>> 0;
  };
  const viewIndex = sample(0x70696e65) >>> 29;
  return Object.freeze({ viewIndex, modelYawDegrees: viewIndex * 45,
    scale: 0.7 + 0.3 * sample(0x7363616c) / 0xffffffff, flip: false, yaw: 0 });
}
