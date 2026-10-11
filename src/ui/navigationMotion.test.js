import { expect, it, vi } from 'vitest';
import { animateWeekNavigation } from './navigationMotion.js';
it('uses opposite directions and cancels earlier navigation without changing content', () => {
  const cancel = vi.fn(), animate = vi.fn();
  const content = { innerHTML: 'current schedule', animate, getAnimations: () => [{ cancel }] };
  vi.stubGlobal('document', { getElementById: () => content });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  animateWeekNavigation(-1); animateWeekNavigation(1);
  const previous = animate.mock.calls[0][0], next = animate.mock.calls[1][0];
  expect(previous[0].transform).toMatch(/^translateX\(-/);
  expect(next[0].transform).toMatch(/^translateX\(\d/);
  expect(previous[1]).toEqual(next[1]);
  expect(cancel).toHaveBeenCalledTimes(2); expect(content.innerHTML).toBe('current schedule');
  animateWeekNavigation(0); expect(animate).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
it('uses the static current content with reduced motion or absent animation support', () => {
  const animate = vi.fn();
  vi.stubGlobal('document', { getElementById: () => ({ animate }) });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  animateWeekNavigation(1); expect(animate).not.toHaveBeenCalled();
  vi.stubGlobal('window', {}); vi.stubGlobal('document', { getElementById: () => ({}) });
  expect(() => animateWeekNavigation(-1)).not.toThrow();
  vi.unstubAllGlobals();
});
