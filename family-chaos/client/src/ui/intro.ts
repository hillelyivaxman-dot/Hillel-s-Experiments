import gsap from 'gsap';

/** Entrance animation for cards. The cards also have a CSS `transition` on transform (hover lift), which
 *  fights GSAP's per-frame writes and leaves them displaced: turn it off while animating, then clear all
 *  inline styles so hover/selected CSS takes over again. */
export function introCards(targets: string | Element[], opts: { y?: number; delay?: number; stagger?: number } = {}) {
  gsap.from(targets, {
    y: opts.y ?? 40, opacity: 0, duration: 0.45, delay: opts.delay ?? 0, stagger: opts.stagger ?? 0.05, ease: 'power3.out',
    onStart() { (this.targets() as HTMLElement[]).forEach((e) => { e.style.transition = 'none'; }); },
    onComplete() { (this.targets() as HTMLElement[]).forEach((e) => { e.style.transition = ''; }); },
    clearProps: 'transform,opacity',
  });
}
