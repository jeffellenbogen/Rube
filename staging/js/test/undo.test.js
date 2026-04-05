import { test, assertEqual } from './run.js';
import { push, undo, redo, canUndo, canRedo, reset } from '../undo.js';
import { getState, loadState, addComponent, resetState } from '../state.js';

test('canUndo false initially', () => { reset(); assertEqual(canUndo(), false); });
test('push makes canUndo true', () => {
  reset();
  push(); // snapshot before mutation
  addComponent({ type:'material', subtype:'ball', x:0,y:0,width:5,height:5,subParts:{},comment:'',commentVisible:false });
  assertEqual(canUndo(), true);
});
test('undo restores state', () => {
  reset();
  push();
  const before = JSON.stringify(getState());
  addComponent({ type:'material', subtype:'ball', x:0,y:0,width:5,height:5,subParts:{},comment:'',commentVisible:false });
  undo();
  assertEqual(JSON.stringify(getState()), before);
});
test('redo re-applies after undo', () => {
  reset();
  push();
  addComponent({ type:'material', subtype:'ball', x:0,y:0,width:5,height:5,subParts:{},comment:'',commentVisible:false });
  const after = JSON.stringify(getState());
  undo();
  redo();
  assertEqual(JSON.stringify(getState()), after);
});
test('push caps stack at MAX 50', () => {
  resetState();
  reset();
  for (let i = 0; i < 55; i++) {
    push();
    addComponent({ type:'material', subtype:'ball', x:i,y:0,width:5,height:5,subParts:{},comment:'',commentVisible:false });
  }
  let undoCount = 0;
  while (canUndo()) { undo(); undoCount++; }
  assertEqual(undoCount, 50);
});
