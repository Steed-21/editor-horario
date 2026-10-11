export function animateWeekNavigation(direction) {
  if (direction !== -1 && direction !== 1) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const content = document.getElementById('tContainer');
  if (!content?.animate) return;
  // Web Animations restarts repeated directions without forced layout or DOM copies.
  content.getAnimations?.().forEach(animation => animation.cancel());
  content.animate([
    { opacity: .65, transform: `translateX(${direction * 8}px)` },
    { opacity: 1, transform: 'translateX(0)' }
  ], { duration: 180, easing: 'cubic-bezier(.16, 1, .3, 1)' });
}
