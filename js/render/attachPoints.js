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
  pts['railLow']     = { x: cmToPx(lowX),      y: cmToPx(y + h - railH) };
  pts['railHigh']    = { x: cmToPx(highX),     y: cmToPx(y - railH) };
  pts['railCenter']  = { x: cmToPx(x + w / 2), y: cmToPx(y + h * 0.20) };
  pts['railStayMid'] = { x: cmToPx(x + w / 2), y: cmToPx(y + h * 0.35) };

  return pts;
}

export const ATTACH_POINTS = {
  // lever: computed dynamically in getAttachPx (tiltSide-dependent)
  ball:          { center: [0.5, 0.5] },
  domino:        { center: [0.5, 0.5] },
  toyCar:        { center: [0.5, 0.5] },
  bucket:        { handle: [0.5, 0.05], bottom: [0.5, 1] },
  cup:           { top: [0.325, 0], bottom: [0.325, 1], handle: [0.88, 0.485] },
  pulley:        { mountTop: [0.5, 0] },
  // inclinedPlane: computed dynamically in getAttachPx (angle-dependent)
  wheelAxle:     { center: [0.5, 0.5] },
  wedge:         { thinEnd: [0, 0.5], thickBase: [1, 1] },
  screw:         { tip: [0.5, 1] },
  book:          { top: [0.5, 0], bottom: [0.5, 1] },
  yardstick:     { left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5] },
  protractor:    { base: [0.5, 1], top: [0.5, 0] },
  matchboxTrack: { left: [0, 0.5], right: [1, 0.5] },
  start:         { output: [1, 0.5] },
  finish:        { input: [0, 0.5] },
};

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
