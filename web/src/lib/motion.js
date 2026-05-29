// Shared GSAP / Lenis helpers. Initialise Lenis once at app boot, hand out a
// hook for page-level entrance + stagger animations, and a tilt-on-hover helper
// for cards. All animations respect prefers-reduced-motion.

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenisInstance = null;
let rafId = null;

export function startLenis() {
  if (typeof window === 'undefined') return null;
  if (lenisInstance) return lenisInstance;
  if (prefersReduced()) return null;

  lenisInstance = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1.2,
  });

  lenisInstance.on('scroll', ScrollTrigger.update);

  const raf = (time) => {
    lenisInstance.raf(time);
    rafId = requestAnimationFrame(raf);
  };
  rafId = requestAnimationFrame(raf);
  ScrollTrigger.refresh();
  return lenisInstance;
}

export function stopLenis() {
  if (rafId) cancelAnimationFrame(rafId);
  if (lenisInstance) lenisInstance.destroy();
  lenisInstance = null;
  rafId = null;
}

export function scrollTo(target, opts = {}) {
  if (lenisInstance) lenisInstance.scrollTo(target, opts);
}

/**
 * Run a GSAP entrance animation when `deps` change.
 *
 * Animates any descendant of `ref.current` matching `[data-anim="fade-up"]`
 * with a simple fade + rise, and `[data-anim="stagger-child"]` with the same
 * effect but staggered. Reduced motion → no animation, just snap visible.
 */
export function usePageEntrance(deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const fadeUps = root.querySelectorAll('[data-anim="fade-up"]');
    const staggers = root.querySelectorAll('[data-anim="stagger-child"]');

    if (prefersReduced()) {
      gsap.set([...fadeUps, ...staggers], { clearProps: 'all', opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      if (fadeUps.length) {
        gsap.fromTo(
          fadeUps,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.06,
            clearProps: 'transform',
          }
        );
      }
      if (staggers.length) {
        gsap.fromTo(
          staggers,
          { y: 18, opacity: 0, scale: 0.985 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.55,
            ease: 'power3.out',
            stagger: { amount: 0.45, from: 'start' },
            clearProps: 'transform',
          }
        );
      }
    }, root);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Subtle tilt + lift on pointer move. Attach to any element via ref.
 * Listens to pointermove on the element; releases on leave.
 */
export function attachTilt(el, { max = 6, scale = 1.01 } = {}) {
  if (!el || prefersReduced()) return () => {};

  const qx = gsap.quickTo(el, 'rotationY', { duration: 0.45, ease: 'power3.out' });
  const qy = gsap.quickTo(el, 'rotationX', { duration: 0.45, ease: 'power3.out' });
  const qs = gsap.quickTo(el, 'scale', { duration: 0.4, ease: 'power3.out' });

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    qx((px - 0.5) * max * 2);
    qy(-(py - 0.5) * max * 2);
    qs(scale);
  };
  const onLeave = () => {
    qx(0);
    qy(0);
    qs(1);
  };

  gsap.set(el, { transformPerspective: 800, transformStyle: 'preserve-3d' });
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
  };
}

/** Animate a number from 0 → value, formatted with `format(v)`. */
export function useCountUp(ref, value, { duration = 1.1, format = (v) => v } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || value == null) return;
    if (prefersReduced()) {
      el.textContent = format(value);
      return;
    }
    const state = { v: 0 };
    const target = Number(value) || 0;
    const tween = gsap.to(state, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = format(state.v);
      },
    });
    return () => tween.kill();
  }, [ref, value, duration, format]);
}
