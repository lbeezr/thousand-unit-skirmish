// Approved default Infantry only; no art, selector, clock or transport override.
import { runUnitAnimation } from './renderer-worker-animation-scenario.mjs';
export const id='infantry-animations';
export const contextVersion=1;
export const run=context=>runUnitAnimation(context,{adapterId:id,militaryKind:'infantry'});
