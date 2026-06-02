// ─── Animation Utilities ──────────────────────────────────────
// Pre-built CSS keyframe animations, Tailwind-inspired.
// Inject once, use via class names in any component.

import { getSheet } from './inject.js'

/** @type {Set<string>} */
const _injected = new Set()

/**
 * Ensure keyframe animations are injected into the global sheet.
 * Idempotent — safe to call from multiple components.
 */
export function injectAnimations() {
  if (typeof document === 'undefined') return
  if (_injected.has('keyframes')) return
  _injected.add('keyframes')

  const style = document.createElement('style')
  style.id = 'up-animations'
  style.textContent = `
    /* ── Fade ──────────────────────────────────────────── */
    @keyframes up-fade-in       { from { opacity: 0 } to { opacity: 1 } }
    @keyframes up-fade-out      { from { opacity: 1 } to { opacity: 0 } }

    /* ── Slide ─────────────────────────────────────────── */
    @keyframes up-slide-up      { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    @keyframes up-slide-down    { from { transform: translateY(-16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    @keyframes up-slide-left    { from { transform: translateX(16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    @keyframes up-slide-right   { from { transform: translateX(-16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }

    /* ── Scale ─────────────────────────────────────────── */
    @keyframes up-scale-in      { from { transform: scale(0.9); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    @keyframes up-scale-out     { from { transform: scale(1); opacity: 1 } to { transform: scale(0.9); opacity: 0 } }

    /* ── Spin ──────────────────────────────────────────── */
    @keyframes up-spin          { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
    @keyframes up-spin-slow     { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

    /* ── Pulse ─────────────────────────────────────────── */
    @keyframes up-pulse         { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }

    /* ── Bounce ────────────────────────────────────────── */
    @keyframes up-bounce        { 0%,100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8,0,1,1) } 50% { transform: translateY(-20%); animation-timing-function: cubic-bezier(0,0,0.2,1) } }

    /* ── Shimmer (skeleton loader) ─────────────────────── */
    @keyframes up-shimmer       { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

    /* ── Utility classes ───────────────────────────────── */
    .up-anim-fade-in     { animation: up-fade-in 0.4s ease both }
    .up-anim-fade-out    { animation: up-fade-out 0.4s ease both }
    .up-anim-slide-up    { animation: up-slide-up 0.4s ease both }
    .up-anim-slide-down  { animation: up-slide-down 0.4s ease both }
    .up-anim-slide-left  { animation: up-slide-left 0.4s ease both }
    .up-anim-slide-right { animation: up-slide-right 0.4s ease both }
    .up-anim-scale-in    { animation: up-scale-in 0.3s ease both }
    .up-anim-scale-out   { animation: up-scale-out 0.3s ease both }
    .up-anim-spin        { animation: up-spin 0.8s linear infinite }
    .up-anim-spin-slow   { animation: up-spin-slow 3s linear infinite }
    .up-anim-pulse       { animation: up-pulse 2s ease-in-out infinite }
    .up-anim-bounce      { animation: up-bounce 0.6s ease both }
    .up-anim-shimmer     { background: linear-gradient(90deg, #e8e8ed 25%, #f0f0f5 50%, #e8e8ed 75%); background-size: 200% 100%; animation: up-shimmer 1.8s ease-in-out infinite }

    /* ── Duration modifiers ────────────────────────────── */
    .up-anim-fast   { animation-duration: 0.2s }
    .up-anim-slow   { animation-duration: 0.7s }
    .up-anim-delay-100 { animation-delay: 0.1s }
    .up-anim-delay-200 { animation-delay: 0.2s }
    .up-anim-delay-300 { animation-delay: 0.3s }
    .up-anim-delay-500 { animation-delay: 0.5s }

    /* ── Iteration modifiers ──────────────────────────── */
    .up-anim-loop      { animation-iteration-count: infinite; animation-direction: alternate }

    /* ── Reduce motion ─────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .up-anim-fade-in, .up-anim-fade-out,
      .up-anim-slide-up, .up-anim-slide-down,
      .up-anim-slide-left, .up-anim-slide-right,
      .up-anim-scale-in, .up-anim-scale-out,
      .up-anim-spin, .up-anim-spin-slow,
          .up-anim-pulse, .up-anim-bounce, .up-anim-loop {
        animation-duration: 0.01ms !important;
      }
    }
  `
  document.head.appendChild(style)
}

/**
 * Animation utility classes reference.
 * Use as: class="up-anim-fade-in up-anim-slow"
 *
 * | Class | Effect |
 * |---|---|
 * | up-anim-fade-in | Fade in (0→1 opacity) |
 * | up-anim-fade-out | Fade out (1→0) |
 * | up-anim-slide-up | Slide up + fade in |
 * | up-anim-slide-down | Slide down + fade in |
 * | up-anim-slide-left | Slide left + fade in |
 * | up-anim-slide-right | Slide right + fade in |
 * | up-anim-scale-in | Scale up + fade in |
 * | up-anim-scale-out | Scale down + fade out |
 * | up-anim-spin | Continuous spin (0.8s) |
 * | up-anim-spin-slow | Slow continuous spin (3s) |
 * | up-anim-pulse | Pulsing opacity |
 * | up-anim-bounce | Bounce effect |
 * | up-anim-shimmer | Shimmer skeleton loader |
 * | up-anim-fast | 0.2s duration |
 * | up-anim-slow | 0.7s duration |
 * | up-anim-delay-100 | 0.1s delay |
 * | up-anim-delay-200 | 0.2s delay |
 * | up-anim-delay-300 | 0.3s delay |
 * | up-anim-delay-500 | 0.5s delay |
 */
export const ANIMATIONS = {
  fadeIn: 'up-anim-fade-in',
  fadeOut: 'up-anim-fade-out',
  slideUp: 'up-anim-slide-up',
  slideDown: 'up-anim-slide-down',
  slideLeft: 'up-anim-slide-left',
  slideRight: 'up-anim-slide-right',
  scaleIn: 'up-anim-scale-in',
  scaleOut: 'up-anim-scale-out',
  spin: 'up-anim-spin',
  spinSlow: 'up-anim-spin-slow',
  pulse: 'up-anim-pulse',
  bounce: 'up-anim-bounce',
  shimmer: 'up-anim-shimmer',
  fast: 'up-anim-fast',
  slow: 'up-anim-slow',
  delay100: 'up-anim-delay-100',
  delay200: 'up-anim-delay-200',
  delay300: 'up-anim-delay-300',
  delay500: 'up-anim-delay-500',
  loop: 'up-anim-loop',
}
