// Scroll-linked motion that CSS can't do on its own. Purely visual: it only adds classes and transforms.
// With prefers-reduced-motion it does nothing, and the CSS shows everything at once.

const SCROLLED_AT = 120;
const REVEAL = '.band, .board, .dark-band, .legend';

export function initMotion() {
  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (reduced?.matches) return;
  root.classList.add('motion-ok');

  const nativeTimeline = window.CSS?.supports?.('animation-timeline: view()');
  const hasIO = 'IntersectionObserver' in window;
  if (!nativeTimeline && hasIO) root.classList.add('motion-io');

  // Each element is revealed once, then forgotten.
  const io = hasIO
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' })
    : null;
  const seen = new WeakSet();

  const scan = () => {
    const targets = [...document.querySelectorAll('.words')];
    if (!nativeTimeline) {
      for (const el of document.querySelectorAll(REVEAL)) {
        if (el.closest('dialog')) continue;
        el.classList.add('reveal-on-scroll');
        targets.push(el);
      }
    }
    for (const el of targets) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (io) io.observe(el);
      else el.classList.add('is-in');
    }
  };

  // The progress ring grows 1 -> 1.08 as it passes through the viewport (CSS does this natively where it can).
  const growRings = () => {
    if (nativeTimeline) return;
    const vh = window.innerHeight;
    for (const ring of document.querySelectorAll('.ring')) {
      const box = ring.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (vh - box.top) / (vh + box.height)));
      ring.style.transform = `scale(${(1 + 0.08 * progress).toFixed(4)})`;
    }
  };

  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      root.classList.toggle('is-scrolled', window.scrollY > SCROLLED_AT);
      growRings();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Screens mount and unmount as you navigate, so look for new sections whenever the DOM changes.
  let pending = 0;
  new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      scan();
      onScroll();
    });
  }).observe(document.body, { childList: true, subtree: true });

  scan();
  onScroll();
}
