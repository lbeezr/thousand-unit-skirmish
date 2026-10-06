// Source-pixel gait controls for the reviewed Infantry NE cutout, not GPU proof.
// Anatomical sides come from the approved unmirrored own-facing seed.
export function inspectInfantryNEFootfall(images) {
  if(images.length!==4)throw Error('NE gait requires four reviewed contact/passing keys');
  const feet=images.map(image=>{
    if(image.width!==256||image.height!==256)throw Error('NE gait requires registered256 canvas');
    const floor=(x0,x1)=>{
      let bottom=-1;
      for(let y=207;y<256;y++)for(let x=x0;x<x1;x++)if(image.pixels[(y*256+x)*4+3]>=128)bottom=Math.max(bottom,y);
      if(bottom<0)throw Error('NE anatomical boot pixels absent');return bottom;
    };
    return {right:floor(75,134),left:floor(134,201)};
  });
  if(!feet.slice(0,2).every(f=>f.left>f.right+6)||!feet.slice(2).every(f=>f.right>f.left+6))
    throw Error('NE gait must exchange anatomical left/right support; distinct frames or body bob do not qualify');
  if(feet[1].right>=feet[0].right-2||feet[3].left>=feet[2].left-2)
    throw Error('NE passing boot must visibly lift under the opposite supporting leg');
  const support=[feet[0].left,feet[1].left,feet[2].right,feet[3].right];
  if(Math.max(...support)-Math.min(...support)>1)throw Error('NE source contact contours drift beyond one pixel');
  return {feet,supportContourRows:support,anatomicalAlternation:true,renderedFootPlanting:false};
}
