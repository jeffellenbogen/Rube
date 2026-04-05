import { test, assert, assertEqual } from './run.js';
import { encodeITXt, decodeITXt } from '../export.js';

test('encodeITXt produces buffer starting with iTXt marker', () => {
  const buf = encodeITXt('TestKey', '{"hello":"world"}');
  const view = new DataView(buf);
  const type = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
  assertEqual(type, 'iTXt');
});

test('decodeITXt round-trips correctly', () => {
  const payload = JSON.stringify({ version: 2, test: true });
  const buf = encodeITXt('RubeGoldbergState', payload);
  const result = decodeITXt(buf, 'RubeGoldbergState');
  assertEqual(result, payload);
});

test('decodeITXt returns null for wrong keyword', () => {
  const buf = encodeITXt('OtherKey', 'data');
  const result = decodeITXt(buf, 'RubeGoldbergState');
  assertEqual(result, null);
});
