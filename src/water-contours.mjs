// Directed boundaries have water on their left in the X/Z plane. A small
// inward bank margin lets both kinds of bend round without covering dry cells.
export function waterRaster(definition) {
  const {width,height}=definition,cells=new Uint8Array(width*height);
  for(const o of definition.obstacles||[])if(o.material==='water')
    for(let r=o.row;r<o.row+o.height;r++)for(let c=o.column;c<o.column+o.width;c++)
      if(c>=0&&c<width&&r>=0&&r<height)cells[r*width+c]=1;
  return cells;
}

export function waterContains(cells,width,height,x,z) {
  // Boundary vertices may belong to either of their incident cells.
  for(const dz of [-1e-8,1e-8])for(const dx of [-1e-8,1e-8]) {
    const c=Math.floor(x+dx),r=Math.floor(z+dz);
    if(c>=0&&r>=0&&c<width&&r<height&&cells[r*width+c])return true;
  }
  return false;
}

export function waterContours(definition,cells=waterRaster(definition)) {
  const {width,height}=definition,edges=[],outgoing=new Map();
  const key=p=>p.join(',');
  const wet=(c,r)=>c>=0&&r>=0&&c<width&&r<height&&cells[r*width+c];
  const add=(a,b,c,r)=>{
    const inside=c>=0&&r>=0&&c<width&&r<height;
    const e={a,b,landIndex:inside?r*width+c:null,shore:inside};
    const index=edges.push(e)-1,list=outgoing.get(key(a))||[];list.push(index);outgoing.set(key(a),list);
  };
  for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(wet(c,r)) {
    if(!wet(c,r-1))add([c,r],[c+1,r],c,r-1);
    if(!wet(c+1,r))add([c+1,r],[c+1,r+1],c+1,r);
    if(!wet(c,r+1))add([c+1,r+1],[c,r+1],c,r+1);
    if(!wet(c-1,r))add([c,r+1],[c,r],c-1,r);
  }
  const used=new Uint8Array(edges.length),rings=[];
  for(let first=0;first<edges.length;first++)if(!used[first]) {
    const ring=[];let index=first;
    do {
      const edge=edges[index];if(used[index])throw Error('Water boundary did not close');
      used[index]=1;ring.push(edge);
      const incoming=[edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]];
      const choices=(outgoing.get(key(edge.b))||[]).filter(i=>!used[i]||i===first);
      // At diagonally touching cells, take the left turn and keep components
      // separate rather than creating a crossing polygon or a phantom bridge.
      choices.sort((a,b)=>{
        const turn=i=>{const e=edges[i],d=[e.b[0]-e.a[0],e.b[1]-e.a[1]];
          return Math.atan2(incoming[0]*d[1]-incoming[1]*d[0],incoming[0]*d[0]+incoming[1]*d[1]);};
        return turn(b)-turn(a);
      });
      if(!choices.length)throw Error('Open water boundary');index=choices[0];
    }while(index!==first);
    rings.push(ring);
  }
  return rings;
}

export function roundedWaterContour(edges,radius=.45,steps=8) {
  const points=[],inset=.14;
  const corners=edges.map((current,i)=>{
    const previous=edges[(i+edges.length-1)%edges.length],v=current.a;
    const d1=[v[0]-previous.a[0],v[1]-previous.a[1]],d2=[current.b[0]-v[0],current.b[1]-v[1]];
    const a=previous.shore?inset:0,b=current.shore?inset:0;
    return d1[0]*d2[1]-d1[1]*d2[0]
      ? [v[0]-d1[1]*a-d2[1]*b,v[1]+d1[0]*a+d2[0]*b]
      : [v[0]-d2[1]*b,v[1]+d2[0]*b];
  });
  for(let i=0;i<edges.length;i++) {
    const previous=edges[(i+edges.length-1)%edges.length],current=edges[i],v=corners[i];
    const p=corners[(i+edges.length-1)%edges.length],q=corners[(i+1)%edges.length];
    const l1=Math.hypot(v[0]-p[0],v[1]-p[1]),l2=Math.hypot(q[0]-v[0],q[1]-v[1]);
    const d1=[(v[0]-p[0])/l1,(v[1]-p[1])/l1],d2=[(q[0]-v[0])/l2,(q[1]-v[1])/l2];
    const cross=d1[0]*d2[1]-d1[1]*d2[0];
    if(!cross||!previous.shore||!current.shore) {
      points.push({point:[...v],edge:current});continue;
    }
    const cut=Math.min(radius,l1*.45,l2*.45);
    const a=[v[0]-cut*d1[0],v[1]-cut*d1[1]],b=[v[0]+cut*d2[0],v[1]+cut*d2[1]];
    const control=v;
    for(let j=0;j<=steps;j++) {
      const t=j/steps,s=1-t;
      points.push({point:[s*s*a[0]+2*s*t*control[0]+t*t*b[0],s*s*a[1]+2*s*t*control[1]+t*t*b[1]],edge:t<.5?previous:current});
    }
  }
  return points;
}

export function contourArea(points) {
  return points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
}

export function contourContains(points,point) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
