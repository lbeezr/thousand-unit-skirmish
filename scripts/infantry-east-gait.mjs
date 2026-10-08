// Own-East source-contour checks preserve each leg's projected depth.
// They do not reconstruct world-space foot planting or GPU playback.
export function inspectInfantryEastFootfall(images) {
  if(images.length!==4)throw Error('East gait requires four contact/support/passing keys');
  const feet=images.map(image=>{
    if(image.width!==256||image.height!==256)throw Error('East requires registered 256 canvas');
    const bounds=(x0,x1,y0,y1)=>{
      let bottom=-1,right=-1;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(image.pixels[(y*256+x)*4+3]>=128){bottom=Math.max(bottom,y);right=Math.max(right,x);}
      if(bottom<0)throw Error('East anatomical boot pixels absent');return {bottom,right};
    };
    return {right:bounds(60,122,223,256),left:bounds(108,181,198,223)};
  });
  const rightContact=feet[0].right.bottom,leftContact=feet[2].left.bottom;
  if(rightContact-leftContact<20)throw Error('East must retain distinct own-leg contact depths');
  if(Math.abs(feet[1].right.bottom-rightContact)>1||Math.abs(feet[2].right.bottom-rightContact)>1
    ||Math.abs(feet[0].left.bottom-leftContact)>1||Math.abs(feet[3].left.bottom-leftContact)>1)
    throw Error('East supporting foot must retain its own source contact contour');
  if(feet[1].left.bottom>leftContact-4||feet[3].right.bottom>rightContact-4)
    throw Error('East must exchange opposite passing legs after each contact');
  if(feet[0].right.right<feet[2].right.right+6||feet[2].left.right<feet[0].left.right+6)
    throw Error('East contact keys must exchange anatomical forward reach');
  return {feet,anatomicalAlternation:true,contactDepthOffset:rightContact-leftContact,renderedFootPlanting:false};
}
