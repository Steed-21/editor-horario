export function setupOperationalGrid(shell, grid, scope = window) {
  if (!shell || !grid || !scope.matchMedia || !scope.MutationObserver) return () => {};
  const capability = scope.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let tracking = false;
  let frame = null;
  let point;

  function deactivate() {
    if (frame !== null) scope.cancelAnimationFrame(frame);
    frame = null;
    grid.style.setProperty('--grid-active', '0');
  }
  function move(event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    point = { x: event.clientX, y: event.clientY };
    if (frame !== null) return;
    frame = scope.requestAnimationFrame(() => {
      frame = null;
      grid.style.setProperty('--grid-x', `${point.x}px`);
      grid.style.setProperty('--grid-y', `${point.y}px`);
      grid.style.setProperty('--grid-dx', `${Math.sin(point.x / 240) * 8}px`);
      grid.style.setProperty('--grid-dy', `${Math.sin(point.y / 240) * 8}px`);
      grid.style.setProperty('--grid-active', '1');
    });
  }
  function leave(event) {
    if (!event.relatedTarget) deactivate();
  }
  function update() {
    grid.hidden = shell.style.display === 'none';
    const enabled = !grid.hidden && capability.matches;
    if (enabled === tracking) return;
    tracking = enabled;
    const method = enabled ? 'addEventListener' : 'removeEventListener';
    scope[method]('pointermove', move);
    scope[method]('pointerout', leave);
    scope[method]('blur', deactivate);
    if (!enabled) deactivate();
  }
  const observer = new scope.MutationObserver(update);
  observer.observe(shell, { attributes: true, attributeFilter: ['style'] });
  capability.addEventListener('change', update);
  update();
  return () => {
    observer.disconnect();
    capability.removeEventListener('change', update);
    scope.removeEventListener('pointermove', move);
    scope.removeEventListener('pointerout', leave);
    scope.removeEventListener('blur', deactivate);
    deactivate();
    grid.hidden = true;
  };
}
