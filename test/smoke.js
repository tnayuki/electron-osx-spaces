const { app, BrowserWindow } = require('electron');
const assert = require('node:assert');
const spaces = require('../index');

let exitCode = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${e.message}`);
    exitCode = 1;
  }
}

app.whenReady().then(() => {
  console.log('electron-osx-spaces smoke tests\n');

  const win = new BrowserWindow({ width: 400, height: 300, show: false });

  // encodeState tests
  test('encodeState returns a Buffer', () => {
    const data = spaces.encodeState(win);
    assert.ok(Buffer.isBuffer(data), `expected Buffer, got ${typeof data}`);
  });

  test('encodeState returns non-empty data', () => {
    const data = spaces.encodeState(win);
    assert.ok(data.length > 100, `expected >100 bytes, got ${data.length}`);
  });

  // restoreState tests
  test('restoreState returns true with valid data', () => {
    const data = spaces.encodeState(win);
    const result = spaces.restoreState(win, data, { restoreSpace: false });
    assert.strictEqual(result, true);
  });

  test('restoreState returns false with null data', () => {
    const result = spaces.restoreState(win, null);
    assert.strictEqual(result, false);
  });

  // encode → restore round-trip
  test('encode → restore round-trip does not crash', () => {
    const data = spaces.encodeState(win);
    spaces.restoreState(win, data, { restoreSpace: true });
    // If we get here, no crash
    assert.ok(true);
  });

  test('multiple encode calls return consistent size', () => {
    const data1 = spaces.encodeState(win);
    const data2 = spaces.encodeState(win);
    // Size should be similar (not necessarily identical due to timestamps)
    assert.ok(
      Math.abs(data1.length - data2.length) < 100,
      `sizes differ too much: ${data1.length} vs ${data2.length}`,
    );
  });

  console.log(
    `\nDone. ${exitCode === 0 ? 'All tests passed.' : 'Some tests failed.'}`,
  );
  app.exit(exitCode);
});
