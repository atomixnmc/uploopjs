/**
 * Frame Loop — v0.0.3
 *
 * Manages requestAnimationFrame loop for visual/draw components.
 * The caller must provide the canvas element; no DOM searching is
 * done here (that's the mount caller's responsibility).
 *
 * @module @uploop/core/component-frame
 */

export function createFrameLoop(frameMode, lifecycleMethods, drawFn, renderFn, instanceLoop, cleanChildren, name) {
  let _animId = null
  let _startTime = 0
  let _lastTime = 0
  let _ctx2d = null

  function start(canvasEl) {
    if (frameMode !== 'visual') return

    if (canvasEl && canvasEl.tagName === 'CANVAS') {
      _ctx2d = canvasEl.getContext('2d')
      instanceLoop._canvasEl = canvasEl
    }

    _startTime = performance.now()
    _lastTime = _startTime

    function tick() {
      const now = performance.now()
      const elapsed = now - _startTime
      const delta = now - _lastTime
      _lastTime = now

      instanceLoop.set({ elapsed, delta })

      const drawHandler = lifecycleMethods.draw || drawFn || renderFn
      if (typeof drawHandler === 'function' && _ctx2d) {
        try {
          drawHandler(_ctx2d, instanceLoop.get(), cleanChildren, { elapsed, delta })
        } catch (e) { console.error(`[Uploop] draw error in "${name}":`, e) }
      }

      _animId = requestAnimationFrame(tick)
    }
    _animId = requestAnimationFrame(tick)
  }

  function stop() {
    if (_animId != null) {
      cancelAnimationFrame(_animId)
      _animId = null
    }
  }

  return {
    start,
    stop,
    get ctx2d() { return _ctx2d },
    set ctx2d(v) { _ctx2d = v },
    get active() { return _animId != null },
    get animId() { return _animId }
  }
}
