// Screen-space helpers for pinned HTML and picking. Pure (no three.js, no DOM)
// so they are unit-tested.

// Where to put a pinned element of size w×h whose anchor projects to (x, y),
// kept `margin` px inside a width×height viewport.
//   align: "center" | "bottom" (element above the point) | "top" (below) | "left"
// Returns { left, top, tail }: the element's top-left corner and how far (px)
// the anchor is from the element's horizontal centre, clamped so a speech
// bubble's tail (CSS var --kit-tail-x) stays on its rounded body.
export function clampPin({
  x,
  y,
  w,
  h,
  align = "center",
  width,
  height,
  margin = 10,
  tailInset = 22,
}) {
  let left = align === "left" ? x : x - w / 2;
  let top = align === "bottom" ? y - h : align === "top" ? y : y - h / 2;
  const fit = (v, size, room) =>
    size + 2 * margin >= room
      ? (room - size) / 2 // bigger than the room: centre it
      : Math.min(Math.max(v, margin), room - margin - size);
  left = fit(left, w, width);
  top = fit(top, h, height);
  const half = Math.max(0, w / 2 - tailInset);
  const tail = Math.max(-half, Math.min(half, x - (left + w / 2)));
  return { left, top, tail };
}

// True when an object and every ancestor are visible (three.js renders nothing
// under a hidden group, so nothing there should be tappable either).
export function isShown(obj) {
  for (let o = obj; o; o = o.parent) if (o.visible === false) return false;
  return true;
}
