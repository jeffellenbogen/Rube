import { test, assertEqual, assert } from './run.js';
import { getAttachPx, getSnapPx } from '../render/attachPoints.js';
import { findNearestAttachment } from '../connections.js';

// In Node tests basePx=1, so cmToPx(x)===x and all positions are in cm.

function makePulley(x, y, w, h, leftCordAngle = 45, leftCordLength = 30) {
  return { id: 'p1', type: 'simple_machine', subtype: 'pulley', x, y, width: w, height: h,
           subParts: { leftCordAngle, leftCordLength, rightCordAngle: 0, rightCordLength: 20 } };
}

test('getSnapPx cordLeft is closer to wheel center than getAttachPx cordLeft', () => {
  const p = makePulley(100, 100, 20, 20, 45, 30);
  const snap = getSnapPx(p);
  const full = getAttachPx(p);
  // Wheel center Y = comp.y + comp.height*0.3 = 106
  const wheelCy = p.y + p.height * 0.3;
  const wheelCx = p.x + p.width / 2;
  const snapDist = Math.hypot(snap.cordLeft.x - wheelCx, snap.cordLeft.y - wheelCy);
  const fullDist = Math.hypot(full.cordLeft.x - wheelCx, full.cordLeft.y - wheelCy);
  assert(snapDist < fullDist, `getSnapPx (${snapDist.toFixed(1)}) should be closer to wheel than getAttachPx (${fullDist.toFixed(1)})`);
});

test('getSnapPx cordLeft is at wheel rim origin (zero cord length)', () => {
  const p = makePulley(100, 100, 20, 20, 90, 25); // cord pointing 90°
  const snap = getSnapPx(p);
  // cordLeft at angle=0 and len=0 would be: cx - r*0.7, cy - h*0.2
  const cx = p.x + p.width / 2;   // 110
  const cy = p.y + p.height / 2;  // 110
  const r  = Math.min(20, 20) * 0.35;  // 7
  const expectedX = cx - r * 0.7; // 110 - 4.9 = 105.1
  const expectedY = cy - 20 * 0.2; // 110 - 4 = 106
  assert(Math.abs(snap.cordLeft.x - expectedX) < 0.01, `x expected ${expectedX}, got ${snap.cordLeft.x}`);
  assert(Math.abs(snap.cordLeft.y - expectedY) < 0.01, `y expected ${expectedY}, got ${snap.cordLeft.y}`);
});

test('getSnapPx cordRight is at wheel rim origin regardless of cord angle', () => {
  const p = makePulley(50, 50, 20, 20, 0, 20);
  p.subParts.rightCordAngle = 135;
  p.subParts.rightCordLength = 40;
  const snap = getSnapPx(p);
  const cx = p.x + p.width / 2;  // 60
  const cy = p.y + p.height / 2; // 60
  const r  = Math.min(20, 20) * 0.35;
  const expectedX = cx + r * 0.7;
  const expectedY = cy - 20 * 0.2;
  assert(Math.abs(snap.cordRight.x - expectedX) < 0.01, `x expected ${expectedX}, got ${snap.cordRight.x}`);
  assert(Math.abs(snap.cordRight.y - expectedY) < 0.01, `y expected ${expectedY}, got ${snap.cordRight.y}`);
});

test('getSnapPx returns unchanged results for non-pulley components', () => {
  const ball = { id: 'b1', type: 'material', subtype: 'ball', x: 50, y: 50, width: 18, height: 18 };
  const snap = getSnapPx(ball);
  const full = getAttachPx(ball);
  for (const [name, pos] of Object.entries(full)) {
    assert(Math.abs(snap[name].x - pos.x) < 0.001 && Math.abs(snap[name].y - pos.y) < 0.001,
      `${name}: snap (${snap[name].x},${snap[name].y}) should equal full (${pos.x},${pos.y})`);
  }
});

test('getSnapPx mountTop is unchanged for pulley', () => {
  const p = makePulley(100, 100, 20, 20);
  const snap = getSnapPx(p);
  const full = getAttachPx(p);
  assert(Math.abs(snap.mountTop.x - full.mountTop.x) < 0.01, 'mountTop.x should be unchanged');
  assert(Math.abs(snap.mountTop.y - full.mountTop.y) < 0.01, 'mountTop.y should be unchanged');
});

function makePulleyState(x, y, w, h, leftCordAngle = 0, leftCordLength = 20) {
  const comp = { id: 'p2', type: 'simple_machine', subtype: 'pulley', x, y, width: w, height: h,
                 subParts: { leftCordAngle, leftCordLength, rightCordAngle: 0, rightCordLength: 20 } };
  return { components: [comp], environment: [], connections: [] };
}

test('findNearestAttachment finds pulley wheel-rim when mouse is near wheel, not cord tip', () => {
  // Pulley at (100,100) size 20×20, cord at angle=0 length=20 (tip is 20cm below wheel)
  // Wheel-rim for cordLeft: cx=110, cy=110, r=7 → x=110-4.9=105.1, y=110-4=106
  const state = makePulleyState(100, 100, 20, 20, 0, 20);
  // Mouse at wheel rim — should snap
  const near = findNearestAttachment(state, 105.1, 106, 'other', 15);
  assert(near !== null, 'should find snap near wheel rim');
  assertEqual(near.compId, 'p2');
  assertEqual(near.pointName, 'cordLeft');
});

test('findNearestAttachment does NOT find pulley when mouse is at cord tip (old behavior)', () => {
  // Old behavior would snap at cord tip (105.1, 126); new behavior targets wheel rim (105.1, 106)
  // Mouse at cord tip position — should NOT snap since snap target moved to wheel rim
  const state = makePulleyState(100, 100, 20, 20, 0, 20);
  // Cord tip is at (105.1, 126); wheel rim is at (105.1, 106); mouse at tip → 20cm from wheel rim
  const near = findNearestAttachment(state, 105.1, 126, 'other', 15);
  assert(near === null, 'mouse at cord tip should not snap (target is now at wheel rim)');
});

test('findNearestAttachment finds pulley regardless of which direction mouse approaches from', () => {
  const state = makePulleyState(100, 100, 20, 20, 90, 30); // cord points right
  // Wheel-rim cordLeft still at same position regardless of cord angle
  const near = findNearestAttachment(state, 105.1, 106, 'other', 10);
  assert(near !== null, 'should find regardless of cord direction');
  assertEqual(near.pointName, 'cordLeft');
});

// ---------------------------------------------------------------------------
// Attachment point tests for new components
// ---------------------------------------------------------------------------

function makeComp(subtype, x, y, w, h) {
  return { id: 'c1', type: 'material', subtype, x, y, width: w, height: h };
}

test('dumpTruck center attach point is at component center', () => {
  const c = makeComp('dumpTruck', 10, 20, 25, 12);
  const pts = getAttachPx(c);
  assertEqual(pts.center.x, 10 + 0.5 * 25);  // 22.5
  assertEqual(pts.center.y, 20 + 0.5 * 12);  // 26
});

test('fan center attach point is at 35% height (center of blade housing)', () => {
  const c = makeComp('fan', 0, 0, 18, 20);
  const pts = getAttachPx(c);
  assertEqual(pts.center.x, 0 + 0.5 * 18);  // 9
  assertEqual(pts.center.y, 0 + 0.35 * 20); // 7
});

test('rubiksCube center attach point is at component center', () => {
  const c = makeComp('rubiksCube', 5, 5, 12, 12);
  const pts = getAttachPx(c);
  assertEqual(pts.center.x, 5 + 0.5 * 12); // 11
  assertEqual(pts.center.y, 5 + 0.5 * 12); // 11
});

test('funnel has topInput at top-center and bottomOutput at bottom-center', () => {
  const c = makeComp('funnel', 10, 10, 15, 20);
  const pts = getAttachPx(c);
  assertEqual(pts.topInput.x, 10 + 0.5 * 15);  // 17.5
  assertEqual(pts.topInput.y, 10 + 0 * 20);     // 10
  assertEqual(pts.bottomOutput.x, 10 + 0.5 * 15); // 17.5
  assertEqual(pts.bottomOutput.y, 10 + 1 * 20);   // 30
});

test('spring has top and bottom attach points at vertical extremes', () => {
  const c = makeComp('spring', 0, 0, 10, 20);
  const pts = getAttachPx(c);
  assertEqual(pts.top.x, 0 + 0.5 * 10);   // 5
  assertEqual(pts.top.y, 0 + 0 * 20);      // 0
  assertEqual(pts.bottom.x, 0 + 0.5 * 10); // 5
  assertEqual(pts.bottom.y, 0 + 1 * 20);   // 20
});

// ---------------------------------------------------------------------------
// Wall ENV_ATTACH points
// ---------------------------------------------------------------------------

function makeEnvItem(subtype, x, y, w, h) {
  return { id: 'e1', type: 'environment', subtype, x, y, width: w, height: h };
}

test('wall has top, center, bottom attach points', () => {
  const wall = makeEnvItem('wall', 0, 0, 5, 40);
  const pts = getAttachPx(wall);
  // ENV_ATTACH fractions: top=[0.5,0], center=[0.5,0.5], bottom=[0.5,1]
  assertEqual(pts.top.x, 0 + 0.5 * 5);    // 2.5
  assertEqual(pts.top.y, 0 + 0 * 40);      // 0
  assertEqual(pts.center.x, 0 + 0.5 * 5); // 2.5
  assertEqual(pts.center.y, 0 + 0.5 * 40); // 20
  assertEqual(pts.bottom.x, 0 + 0.5 * 5); // 2.5
  assertEqual(pts.bottom.y, 0 + 1 * 40);  // 40
});

// ---------------------------------------------------------------------------
// Person dynamic attach points
// ---------------------------------------------------------------------------

function makePerson(x, y, w, h, pose) {
  return { id: 'p1', type: 'marker', subtype: 'person', x, y, width: w, height: h,
           subParts: { pose } };
}

test('person push pose: hand is at right side (0.9, 0.4)', () => {
  const p = makePerson(0, 0, 20, 30, 'push');
  const pts = getAttachPx(p);
  // cx=10, cy=15; handFx=0.9, handFy=0.4 → dx=(0.9-0.5)*20=8, dy=(0.4-0.5)*30=-3
  // hand = { x: 10+8=18, y: 15-3=12 }
  assert(Math.abs(pts.hand.x - 18) < 0.01, `push hand.x expected 18, got ${pts.hand.x}`);
  assert(Math.abs(pts.hand.y - 12) < 0.01, `push hand.y expected 12, got ${pts.hand.y}`);
});

test('person drop pose: hand is lower-right (0.6, 0.7)', () => {
  const p = makePerson(0, 0, 20, 30, 'drop');
  const pts = getAttachPx(p);
  // dx=(0.6-0.5)*20=2, dy=(0.7-0.5)*30=6 → { x: 12, y: 21 }
  assert(Math.abs(pts.hand.x - 12) < 0.01, `drop hand.x expected 12, got ${pts.hand.x}`);
  assert(Math.abs(pts.hand.y - 21) < 0.01, `drop hand.y expected 21, got ${pts.hand.y}`);
});

test('person pull pose: hand is at left side (0.1, 0.4)', () => {
  const p = makePerson(0, 0, 20, 30, 'pull');
  const pts = getAttachPx(p);
  // dx=(0.1-0.5)*20=-8, dy=(0.4-0.5)*30=-3 → { x: 2, y: 12 }
  assert(Math.abs(pts.hand.x - 2) < 0.01, `pull hand.x expected 2, got ${pts.hand.x}`);
  assert(Math.abs(pts.hand.y - 12) < 0.01, `pull hand.y expected 12, got ${pts.hand.y}`);
});

test('person defaults to push pose when subParts missing', () => {
  const p = { id: 'p2', type: 'marker', subtype: 'person', x: 0, y: 0, width: 20, height: 30 };
  const pts = getAttachPx(p);
  // Should default to push: hand.x = 18
  assert(Math.abs(pts.hand.x - 18) < 0.01, `default pose hand.x expected 18, got ${pts.hand.x}`);
});
