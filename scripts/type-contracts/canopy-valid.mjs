// Compile-only consumer: keep numeric cell identity, world x/z and optional lookups checked.
import { forestAgeFactors } from '../../src/forest-age-composition.mjs';

const points = Object.freeze([
  Object.freeze({ cell: 7, x: 1.5, z: -2, species: 'hornbeam', scale: 0.9 }),
  Object.freeze({ cell: 8, x: 2.5, z: -2, species: 'root-oak', scale: 1.2 }),
]);
const factors = forestAgeFactors(points, 93002, 1.6);
forestAgeFactors(points);
forestAgeFactors([]);

/** @type {Map<number, number>} */
const byCell = factors;
const factor = byCell.get(points[0].cell);
if (factor !== undefined) factor.toFixed(2);
