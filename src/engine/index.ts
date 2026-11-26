/** GeoFound calculation engine — public API (pure TypeScript, no UI). */
export * from './units';
export * from './trace';
export * from './types';
export * from './stress';
export * from './spt';
export * from './labTests';
export * from './bearing';
export * from './stressIncrease';
export * from './settlement';
export * from './design';

/** Load factor for group g: λ = 1 + g/100 (assignment brief). */
export const loadFactor = (g: number): number => 1 + g / 100;
export * from './piles';
export * from './finalDesign';
