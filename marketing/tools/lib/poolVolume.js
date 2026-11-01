// File: src/lib/poolVolume.js
//
// Pool volume in litres.
//
// rectangularVolumeLitres is the estimator the app uses on Pool setup and
// in the volume gate: length × width × average depth (metres) × 1,000,
// rounded to the nearest litre. The marketing volume tool calls it for
// rectangles, after averaging the shallow and deep ends — the same
// "average depth = (shallow + deep) ÷ 2" rule the setup screen describes.
//
// Round, oval and kidney are not calculated anywhere in the app (setup
// only multiplies a rectangle; onboarding mentions a rough ×800 hint in
// copy and does not run it). Those three use standard geometry here.

/** Rectangle. Same sum as SetupPage / VolumeGateModal in App.jsx. */
export function rectangularVolumeLitres(lengthM, widthM, depthM) {
  const l = parseFloat(lengthM);
  const w = parseFloat(widthM);
  const d = parseFloat(depthM);
  if (l > 0 && w > 0 && d > 0) return Math.round(l * w * d * 1000);
  return null;
}

/** (shallow + deep) ÷ 2. Null unless both ends are greater than zero. */
export function averageDepthMetres(shallowM, deepM) {
  const s = parseFloat(shallowM);
  const d = parseFloat(deepM);
  if (s > 0 && d > 0) return (s + d) / 2;
  return null;
}

// Kidney / freeform: 85% of the bounding rectangle. A common approximation
// when the pool is not a true rectangle, circle or ellipse. Not from the app.
export const KIDNEY_OF_RECTANGLE = 0.85;

export const VOLUME_SHAPES = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'round', label: 'Round' },
  { id: 'oval', label: 'Oval' },
  { id: 'kidney', label: 'Kidney / freeform' },
];

/**
 * Litres for a shape. Depth is the average of shallowM and deepM unless
 * depthM is passed (the app's setup field is already an average).
 * Returns null when the measurements are not usable.
 */
export function poolVolumeLitres(shape, dims) {
  if (!dims || typeof dims !== 'object') return null;
  const depth = dims.depthM != null && dims.depthM !== ''
    ? parseFloat(dims.depthM)
    : averageDepthMetres(dims.shallowM, dims.deepM);
  if (!(depth > 0)) return null;

  if (shape === 'rectangle') {
    return rectangularVolumeLitres(dims.lengthM, dims.widthM, depth);
  }
  if (shape === 'round') {
    const diameter = parseFloat(dims.diameterM);
    if (!(diameter > 0)) return null;
    const radius = diameter / 2;
    return Math.round(Math.PI * radius * radius * depth * 1000);
  }
  if (shape === 'oval') {
    const length = parseFloat(dims.lengthM);
    const width = parseFloat(dims.widthM);
    if (!(length > 0) || !(width > 0)) return null;
    return Math.round(Math.PI * (length / 2) * (width / 2) * depth * 1000);
  }
  if (shape === 'kidney') {
    const length = parseFloat(dims.lengthM);
    const width = parseFloat(dims.widthM);
    if (!(length > 0) || !(width > 0)) return null;
    return Math.round(length * width * depth * KIDNEY_OF_RECTANGLE * 1000);
  }
  return null;
}
