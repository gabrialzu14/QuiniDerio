/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('app/components/HeroDepthBackground.tsx', 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
function emitter(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); }
  }, extra);
}
function mount({ desktop = false, reduced = false, permission, sensor = true } = {}) {
  const hero = emitter({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) });
  const layer = { parentElement: hero, style: {} }, button = { hidden: true, disabled: false };
  const media = emitter({ matches: reduced }), pointer = emitter({ matches: desktop });
  const screen = emitter({ angle: 0 });
  const window = emitter({ matchMedia: q => q.includes('reduced') ? media : pointer, screen: { orientation: screen } });
  if (sensor) window.DeviceOrientationEvent = permission ? { requestPermission: permission } : {};
  const document = emitter({ hidden: false });
  let effect, cleanup, observe;
  const frames = new Map(); let id = 0, time = 0, ref = 0;
  const activate = { current: async () => {} };
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => name === 'react' ? {
      useEffect: fn => { effect = fn; }, useRef: () => ref < 2 ? ({ current: [layer, button][ref++] }) : activate
    } : { jsx: () => null, jsxs: () => null }, window, document,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: key => frames.delete(key),
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} }
  });
  exports.default(); cleanup = effect();
  return { window, document, hero, layer, button, media, screen, frames, cleanup, activate: () => activate.current(),
    visible(value) { observe([{ isIntersecting: value }]); },
    tilt(beta, gamma) { window.emit('deviceorientation', { beta, gamma }); },
    settle() { for (let i = 0; frames.size && i < 250; i++) { const batch = [...frames.values()]; frames.clear(); time += 16; batch.forEach(fn => fn(time)); } },
    xy() { if (layer.style.transform === 'translate3d(0, 0, 0)') return [0, 0]; return [...layer.style.transform.matchAll(/(-?[\d.]+)px/g)].map(m => +m[1]); }
  };
}
const mobile = mount();
mobile.tilt(40, 10); mobile.settle(); assert.deepEqual(mobile.xy(), [0, 0]);
mobile.tilt(85, 60); assert.equal(mobile.frames.size, 1); mobile.settle(); assert.deepEqual(mobile.xy(), [-15, -15]);
mobile.screen.emit('change'); mobile.tilt(80, 50); mobile.settle(); assert.deepEqual(mobile.xy(), [0, 0]);
mobile.tilt(70, 40); mobile.visible(false); assert.equal(mobile.frames.size, 0); assert.deepEqual(mobile.xy(), [0, 0]);
mobile.visible(true); mobile.tilt(0, 0); mobile.tilt(20, 20); mobile.document.hidden = true; mobile.document.emit('visibilitychange'); assert.equal(mobile.frames.size, 0);
mobile.cleanup();
const desktop = mount({ desktop: true });
desktop.hero.emit('pointermove', { pointerType: 'mouse', clientX: 400, clientY: 300 }); desktop.settle(); assert.deepEqual(desktop.xy(), [-15, -15]);
desktop.hero.emit('pointerleave'); desktop.settle(); assert.deepEqual(desktop.xy(), [0, 0]); desktop.cleanup();
const reduced = mount({ reduced: true }); reduced.tilt(0, 0); reduced.tilt(50, 50); assert.equal(reduced.frames.size, 0); assert.equal(reduced.button.hidden, true); reduced.cleanup();
const ios = mount({ permission: async () => 'granted' }); assert.equal(ios.button.hidden, false); ios.tilt(0, 0); ios.tilt(20, 20); assert.equal(ios.frames.size, 0); ios.cleanup();
const unsupported = mount({ sensor: false }); assert.equal(unsupported.button.hidden, true); assert.equal(unsupported.frames.size, 0); unsupported.cleanup();
console.log('Hero depth: calibration, bounds, desktop, visibility, reduced motion, permission gate and unsupported sensors passed.');

(async () => {
  for (const result of ['granted', 'denied', 'error']) {
    const app = mount({ permission: async () => { if(result === 'error') throw new Error('unavailable'); return result; } });
    await app.activate(); assert.equal(app.button.hidden, true);
    app.tilt(0, 0); app.tilt(30, 30); app.settle();
    assert.deepEqual(app.xy(), result === 'granted' ? [-15, -15] : [0, 0]); app.cleanup();
  }
  console.log('Hero depth: permission grant, denial and rejection passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
