// Compile-only composition of immutable authored rectangles, cell depths and species IDs.
import { forestHabitatDepth, forestCanopyFactor, forestMarginCanopyFactor } from '../../src/presentation/rendering/forest/habitat.mjs';
import { underboughForestSpecies } from '../../src/presentation/rendering/forest/composition.mjs';

/** @type {import('../../src/presentation/rendering/forest/habitat.mjs').ForestHabitatMap} */
const map = Object.freeze({ width: 9, height: 9, obstacles: Object.freeze([
  Object.freeze({ column: 1, row: 1, width: 7, height: 7, material: 'forest' }),
  Object.freeze({ column: 0, row: 0, width: 1, height: 1 }),
]) });
forestHabitatDepth({ width: 4, height: 4 });
forestHabitatDepth({ width: 4, height: 4, obstacles: null });

/** @type {Uint16Array} */
const depths = forestHabitatDepth(map);
const row = 4, column = 4, depth = depths[row * map.width + column];
const factor = forestCanopyFactor(depth) * forestMarginCanopyFactor(depth, column, row, 93002);
factor.toFixed(2);

/** @type {import('../../src/presentation/rendering/forest/composition.mjs').UnderboughForestSpecies} */
const species = underboughForestSpecies(column, row, 93002, depth, 6);
underboughForestSpecies(column, row);
species.toUpperCase();
