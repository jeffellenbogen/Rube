let passed = 0, failed = 0;
export function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch(e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
export function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}
export function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
process.on('exit', () => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
});
