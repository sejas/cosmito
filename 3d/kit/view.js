// Camera framing maths. Pure (no three.js) so it is unit-tested.

const rad = (d) => (d * Math.PI) / 180;

// Distance a camera must be from a width×height rectangle (facing it) so the
// whole rectangle fits, for a vertical field of view (degrees) and aspect.
export function fitDistance(width, height, fovDeg, aspect) {
  const tv = Math.tan(rad(fovDeg) / 2);
  const th = tv * aspect;
  return Math.max(height / 2 / tv, width / 2 / th);
}

// Camera position looking at `center` ([x,y,z]) from `distance`, raised by
// `elevationDeg` and turned by `azimuthDeg` (0 = from +z, the front).
export function orbitPosition(
  center,
  distance,
  elevationDeg = 20,
  azimuthDeg = 0,
) {
  const e = rad(elevationDeg);
  const a = rad(azimuthDeg);
  return [
    center[0] + distance * Math.cos(e) * Math.sin(a),
    center[1] + distance * Math.sin(e),
    center[2] + distance * Math.cos(e) * Math.cos(a),
  ];
}

// Convenience: frame a width×height area around `center` for a viewport.
// Returns { position, target, distance }. `margin` adds breathing room (1.1 = 10 %).
export function frame({
  center = [0, 0, 0],
  width = 10,
  height = 6,
  fov = 40,
  aspect = 1,
  elevation = 20,
  azimuth = 0,
  margin = 1.1,
}) {
  const distance = fitDistance(width * margin, height * margin, fov, aspect);
  return {
    position: orbitPosition(center, distance, elevation, azimuth),
    target: [...center],
    distance,
  };
}
