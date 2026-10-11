import { expect, it, vi } from 'vitest';
import { setupOperationalGrid } from './operationalGrid.js';

function fixture({ fine = true, hover = true, reduced = false, hidden = false } = {}) {
  const listeners = new Map();
  const values = new Map();
  let observe;
  let flush;
  const capability = { matches: fine && hover && !reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const scope = {
    matchMedia: vi.fn(() => capability),
    MutationObserver: class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() {}
    },
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
    removeEventListener: vi.fn(name => listeners.delete(name)),
    requestAnimationFrame: vi.fn(callback => { flush = callback; return 1; }),
    cancelAnimationFrame: vi.fn(() => { flush = null; }),
  };
  const shell = { style: { display: hidden ? 'none' : '' } };
  const grid = { hidden: true, style: { setProperty: (name, value) => values.set(name, value) } };
  const stop = setupOperationalGrid(shell, grid, scope);
  return { scope, shell, grid, values, listeners, capability, stop, observe: () => observe(), flush: () => flush?.() };
}

it('does not interrupt application startup when decorative APIs are unavailable', () => {
  const grid = { hidden: true };
  expect(() => setupOperationalGrid({ style: { display: '' } }, grid, {})()).not.toThrow();
  expect(grid.hidden).toBe(true);
});

it.each([
  [{}, true],
  [{ fine: false }, false],
  [{ hover: false }, false],
  [{ reduced: true }, false],
])('tracks only capable desktop pointers: %j', (mode, enabled) => {
  const f = fixture(mode);
  expect(f.grid.hidden).toBe(false);
  expect(f.listeners.has('pointermove')).toBe(enabled);
  expect(f.scope.requestAnimationFrame).not.toHaveBeenCalled();
  f.stop();
});

it('coalesces movement, ignores touch, and cancels pending activity on pointer exit', () => {
  const f = fixture();
  const move = f.listeners.get('pointermove');
  move({ pointerType: 'touch', clientX: 1, clientY: 2 });
  expect(f.scope.requestAnimationFrame).not.toHaveBeenCalled();
  move({ pointerType: 'mouse', clientX: 10, clientY: 20 });
  move({ pointerType: 'mouse', clientX: 30, clientY: 40 });
  expect(f.scope.requestAnimationFrame).toHaveBeenCalledTimes(1);
  f.flush();
  expect(f.values.get('--grid-x')).toBe('30px');
  expect(f.values.get('--grid-y')).toBe('40px');
  expect(f.values.get('--grid-active')).toBe('1');
  expect(f.scope.requestAnimationFrame).toHaveBeenCalledTimes(1);
  move({ pointerType: 'mouse', clientX: 50, clientY: 60 });
  f.listeners.get('pointerout')({ relatedTarget: null });
  f.flush();
  expect(f.values.get('--grid-active')).toBe('0');
  f.stop();
});

it('follows shell visibility and capability changes without duplicate listeners', () => {
  const f = fixture({ hidden: true });
  expect(f.grid.hidden).toBe(true);
  expect(f.listeners.size).toBe(0);
  f.shell.style.display = '';
  f.observe(); f.observe();
  expect(f.grid.hidden).toBe(false);
  expect(f.scope.addEventListener.mock.calls.filter(([name]) => name === 'pointermove')).toHaveLength(1);
  f.capability.matches = false;
  f.capability.addEventListener.mock.calls[0][1]();
  expect(f.listeners.size).toBe(0);
  expect(f.values.get('--grid-active')).toBe('0');
  f.capability.matches = true;
  f.observe();
  f.shell.style.display = 'none';
  f.observe();
  expect(f.grid.hidden).toBe(true);
  expect(f.listeners.size).toBe(0);
  f.stop();
});
