import { cmToPx } from '../canvas.js';

const DEFAULT_ATTACH = { input: [0, 0.5], output: [1, 0.5] };

// Static attachment points for environment items (as [fx, fy] fractions)
const ENV_ATTACH = {
  desk: {
    leftLegTop:   [0.07, 0.12],
    rightLegTop:  [0.93, 0.12],
    leftLegMid:   [0.07, 0.56],
    rightLegMid:  [0.93, 0.56],
  },
  chair: {
    seatCenter: [0.50, 0.45],
    seatBack:   [0.05, 0.22],
  },
  couch: {
    leftArmTop:  [0.04,  0.13],
    rightArmTop: [0.96,  0.13],
    seatLeft:    [0.285, 0.50],
    seatCenter:  [0.50,  0.50],
    seatRight:   [0.715, 0.50],
  },
  wall: {
    top:    [0.5, 0],
    center: [0.5, 0.5],
    bottom: [0.5, 1],
  },
};

function computeStairsAttach(item) {
  const N = item.stepCount || 6;
  const { x, y, width: w, height: h, flipped } = item;
  const railH = h * 0.30;
  const pts = {};

  // One point per stair step (center-top of each step), accounting for flip
  for (let i = 0; i < N; i++) {
    const fx = flipped ? (N - 1 - i + 0.5) / N : (i + 0.5) / N;
    const fy = (N - 1 - i) / N;
    pts[`step${i}`] = { x: cmToPx(x + fx * w), y: cmToPx(y + fy * h) };
  }

  // Railing: low end (bottom post top), high end (top post top — above bbox), center
  const lowX  = flipped ? x + w : x;
  const highX = flipped ? x     : x + w;
  pts['railLow']    = { x: cmToPx(lowX),      y: cmToPx(y + h - railH) };
  pts['railCenter'] = { x: cmToPx(x + w / 2), y: cmToPx(y + h * 0.20) };
  pts['railHigh']   = { x: cmToPx(highX),     y: cmToPx(y - railH) };

  return pts;
}

// Returns live pixel positions for string endpoints, resolving connected components.
// Used by rendering and UI so the string visually tracks what it's attached to.
export function getStringEndpoints(comp, state) {
  let x1 = cmToPx(comp.subParts?.x1 ?? comp.x);
  let y1 = cmToPx(comp.subParts?.y1 ?? (comp.y + comp.height / 2));
  let x2 = cmToPx(comp.subParts?.x2 ?? (comp.x + comp.width));
  let y2 = cmToPx(comp.subParts?.y2 ?? (comp.y + comp.height / 2));
  for (const conn of state.connections) {
    let endKey, otherKey, otherId;
    if (conn.fromId === comp.id && (conn.fromPoint === 'end1' || conn.fromPoint === 'end2')) {
      endKey = conn.fromPoint; otherKey = conn.toPoint; otherId = conn.toId;
    } else if (conn.toId === comp.id && (conn.toPoint === 'end1' || conn.toPoint === 'end2')) {
      endKey = conn.toPoint; otherKey = conn.fromPoint; otherId = conn.fromId;
    } else continue;
    const other = [...(state.components || []), ...(state.environment || [])].find(c => c.id === otherId);
    if (!other) continue;
    const pt = getAttachPx(other)[otherKey];
    if (!pt) continue;
    if (endKey === 'end1') { x1 = pt.x; y1 = pt.y; }
    else                   { x2 = pt.x; y2 = pt.y; }
  }
  return { x1, y1, x2, y2 };
}

export const ATTACH_POINTS = {
  // lever: computed dynamically in getAttachPx (tiltSide-dependent)
  ball:          { center: [0.5, 0.5] },
  domino:        { center: [0.5, 0.5] },
  toyCar:        { center: [0.5, 0.5] },
  dumpTruck:     { center: [0.5, 0.5] },
  fan:           { center: [0.5, 0.35] },
  rubiksCube:    { center: [0.5, 0.5] },
  bucket:        { handle: [0.5, 0.05], bottom: [0.5, 1] },
  cup:           { top: [0.325, 0], bottom: [0.325, 1], handle: [0.88, 0.485] },
  funnel:        { topInput: [0.5, 0], bottomOutput: [0.5, 1] },
  pulley:        { mountTop: [0.5, 0] },
  // inclinedPlane: computed dynamically in getAttachPx (angle-dependent)
  wheelAxle:     { center: [0.5, 0.5] },
  wedge:         { thinEnd: [0, 0.5], thickBase: [1, 1] },
  screw:         { tip: [0.5, 1] },
  book:          { top: [0.5, 0], bottom: [0.5, 1] },
  spring:        { top: [0.5, 0], bottom: [0.5, 1] },
  yardstick:     { left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5] },
  protractor:    { base: [0.5, 1], top: [0.5, 0] },
  matchboxTrack: { left: [0, 0.5], right: [1, 0.5] },
  start:         { output: [1, 0.5] },
  finish:        { input: [0, 0.5] },
};

/**
 * Returns snap-target pixel positions for a component.
 * Identical to getAttachPx for most subtypes; for pulleys, cordLeft/cordRight
 * snap to the wheel-rim origin rather than the hanging cord tip, so users can
 * approach from any direction and the snap still fires.
 */
export function getSnapPx(comp) {
  if (comp.subtype === 'pulley') {
    const cx = cmToPx(comp.x + comp.width / 2);
    const cy = cmToPx(comp.y + comp.height / 2);
    const w  = cmToPx(comp.width);
    const h  = cmToPx(comp.height);
    const r  = Math.min(w, h) * 0.35;
    const deg   = (comp.rotation || 0) * Math.PI / 180;
    const flipX = comp.flipped ? -1 : 1;
    function applyT(dx, dy) {
      const rdx = dx * Math.cos(deg) - dy * Math.sin(deg);
      const rdy = dx * Math.sin(deg) + dy * Math.cos(deg);
      return { x: cx + rdx * flipX, y: cy + rdy };
    }
    return {
      ...getAttachPx(comp),
      cordLeft:  applyT(-r * 0.7, -h * 0.2),
      cordRight: applyT( r * 0.7, -h * 0.2),
    };
  }
  return getAttachPx(comp);
}

export function getAttachPx(comp) {
  const cx = cmToPx(comp.x + comp.width / 2);
  const cy = cmToPx(comp.y + comp.height / 2);
  const w = cmToPx(comp.width), h = cmToPx(comp.height);
  const deg = (comp.rotation || 0) * Math.PI / 180;
  const flipX = comp.flipped ? -1 : 1;

  function applyTransform(dx, dy) {
    const rdx = dx * Math.cos(deg) - dy * Math.sin(deg);
    const rdy = dx * Math.sin(deg) + dy * Math.cos(deg);
    return { x: cx + rdx * flipX, y: cy + rdy };
  }

  // Person: hand attachment point varies by pose
  if (comp.subtype === 'person') {
    const pose = comp.subParts?.pose || 'push';
    let handFx, handFy;
    if (pose === 'push')      { handFx = 0.9; handFy = 0.4; }
    else if (pose === 'drop') { handFx = 0.6; handFy = 0.7; }
    else if (pose === 'pull') { handFx = 0.1; handFy = 0.4; }
    return { hand: applyTransform((handFx - 0.5) * w, (handFy - 0.5) * h) };
  }

  // Lever: attach points follow the tilted bar ends.
  if (comp.subtype === 'lever') {
    const tiltSide = (comp.subParts && comp.subParts.tiltSide) || 'none';
    const barFy = 0.4;
    const tiltAmt = 0.25;
    let leftFy, rightFy;
    if (tiltSide === 'left') {
      leftFy  = barFy - tiltAmt;
      rightFy = barFy + tiltAmt;
    } else if (tiltSide === 'right') {
      leftFy  = barFy + tiltAmt;
      rightFy = barFy - tiltAmt;
    } else {
      leftFy = rightFy = barFy;
    }
    return {
      left:  applyTransform(-w / 2, (leftFy  - 0.5) * h),
      right: applyTransform( w / 2, (rightFy - 0.5) * h),
    };
  }

  // Inclined plane: connectors sit exactly at the two ends of the plank.
  if (comp.subtype === 'inclinedPlane') {
    const angle = (comp.subParts && comp.subParts.angle) || 30;
    const rad = angle * Math.PI / 180;
    const blockW = w * 0.20;
    const blockH = Math.min(h * 0.85, (w - blockW * 0.5) * Math.tan(rad));
    return {
      lowEnd:  applyTransform(-w / 2,  h / 2),
      highEnd: applyTransform( w / 2,  h / 2 - blockH),
    };
  }

  // String: endpoints stored as absolute canvas positions in subParts
  if (comp.subtype === 'string') {
    const x1 = comp.subParts?.x1 ?? comp.x;
    const y1 = comp.subParts?.y1 ?? (comp.y + comp.height / 2);
    const x2 = comp.subParts?.x2 ?? (comp.x + comp.width);
    const y2 = comp.subParts?.y2 ?? (comp.y + comp.height / 2);
    return {
      end1: { x: cmToPx(x1), y: cmToPx(y1) },
      end2: { x: cmToPx(x2), y: cmToPx(y2) },
    };
  }

  // Pulley: cordLeft/cordRight attach points follow the angled cord ends.
  if (comp.subtype === 'pulley') {
    const r = Math.min(w, h) * 0.35;
    const lcl = cmToPx((comp.subParts && comp.subParts.leftCordLength) || 20);
    const rcl = cmToPx((comp.subParts && comp.subParts.rightCordLength) || 20);
    const lRad = ((comp.subParts && comp.subParts.leftCordAngle) || 0) * Math.PI / 180;
    const rRad = ((comp.subParts && comp.subParts.rightCordAngle) || 0) * Math.PI / 180;
    return {
      mountTop:  applyTransform(0, -h * 0.2 - r * 1.3),
      cordLeft:  applyTransform(-r * 0.7 + lcl * Math.sin(lRad), -h * 0.2 + lcl * Math.cos(lRad)),
      cordRight: applyTransform( r * 0.7 + rcl * Math.sin(rRad), -h * 0.2 + rcl * Math.cos(rRad)),
    };
  }

  // Env items with static attachment fractions
  if (ENV_ATTACH[comp.subtype]) {
    const result = {};
    for (const [name, [fx, fy]] of Object.entries(ENV_ATTACH[comp.subtype])) {
      result[name] = { x: cmToPx(comp.x + fx * comp.width), y: cmToPx(comp.y + fy * comp.height) };
    }
    return result;
  }
  // Stairs: dynamic attach points based on step count
  if (comp.subtype === 'stairs') {
    return computeStairsAttach(comp);
  }

  const pts = ATTACH_POINTS[comp.subtype] || DEFAULT_ATTACH;
  const result = {};
  for (const [name, [fx, fy]] of Object.entries(pts)) {
    const dx = (fx - 0.5) * w;
    const dy = (fy - 0.5) * h;
    result[name] = applyTransform(dx, dy);
  }
  return result;
}
