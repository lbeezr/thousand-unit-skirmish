// Pixel controls for independently reviewed own-view lower-leg cutouts.
// Exact approved pose hashes and source review complement this narrow check.
export function inspectInfantrySourceFootfall(images,spec) {
  if(images.length!==4)throw Error(`${spec.heading} requires four contact/support/passing keys`);
  const feet=images.map(image=>{
    if(image.width!==256||image.height!==256)throw Error('Own-view gait requires registered 256 canvas');
    return Object.fromEntries(['right','left'].map(side=>{
      const [x0,x1,y0,y1]=spec.regions[side];let bottom=-1,tip=-Infinity;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(image.pixels[(y*256+x)*4+3]>=128)bottom=Math.max(bottom,y);
      if(bottom<0)throw Error(`${spec.heading} ${side} boot pixels absent`);
      const [rx0,rx1,ry0,ry1]=spec.reachRegions?.[side]??spec.regions[side];
      for(let y=ry0;y<ry1;y++)for(let x=rx0;x<rx1;x++)if(image.pixels[(y*256+x)*4+3]>=128)tip=Math.max(tip,spec.forwardSign*x);
      if(spec.forwardAxis==='y')tip=spec.forwardSign*bottom;
      if(!Number.isFinite(tip))throw Error(`${spec.heading} distal boot reach absent`);
      return [side,{bottom,tip}];
    }));
  });
  for(const [side,support,passing] of [['right',[0,1,2],3],['left',[0,2,3],1]]){
    if(support.some(i=>Math.abs(feet[i][side].bottom-(spec.contactRowsByKey?.[side]?.[i]??spec.contactRows[side]))>1))
      throw Error(`${spec.heading} supporting foot must retain its own source contact contour`);
    const contactReference=Math.min(...support.map(i=>spec.contactRowsByKey?.[side]?.[i]??spec.contactRows[side]));
    if(feet[passing][side].bottom>contactReference-4)
      throw Error(`${spec.heading} must exchange opposite passing legs after each contact`);
  }
  if(feet[0].right.tip<feet[2].right.tip+6||feet[2].left.tip<feet[0].left.tip+6)
    throw Error(`${spec.heading} contacts must exchange anatomical forward reach`);
  return {feet,anatomicalAlternation:true,contactDepthOffset:spec.contactRows.right-spec.contactRows.left,renderedFootPlanting:false};
}
