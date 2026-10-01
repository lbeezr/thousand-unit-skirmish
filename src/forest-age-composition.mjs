// Presentation only: retain every wood-cell root and resource owner.
export function forestAgeFactors(points, seed=0, radius=1.6) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Canopy spacing radius must be positive');
  const hash=cell=>{let n=(cell^Math.imul(seed|0,0x9e3779b1))>>>0;
    n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return(n^(n>>>15))>>>0;};
  const ranked=points.map(p=>({...p,rank:hash(p.cell)})),buckets=new Map();
  const key=(x,z)=>`${Math.floor(x/radius)},${Math.floor(z/radius)}`;
  for(const p of ranked){const k=key(p.x,p.z),list=buckets.get(k)||[];list.push(p);buckets.set(k,list);}
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
