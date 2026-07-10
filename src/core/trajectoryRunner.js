// src/core/trajectoryRunner.js

let activeAnimationId = null;

/**
 * Creates and runs a linear or S-curve trajectory interpolation between current 
 * and target joint states.
 * 
 * @param {Array<number>} startAngles - Start joint angles
 * @param {Array<number>} endAngles - Target joint angles
 * @param {number} durationMs - Duration of move in milliseconds
 * @param {Function} onStep - Callback invoked each frame with (currentAngles)
 * @param {Function} onComplete - Callback invoked on completion
 * @returns {Object} Control handle { abort: Function }
 */
export function runJointTrajectory(startAngles, endAngles, durationMs, onStep, onComplete) {
  // Cancel any active animation/trajectory execution first
  abortActiveTrajectory();

  const startTime = performance.now();
  let aborted = false;

  function tick(now) {
    if (aborted) return;

    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1.0);
    
    // Apply interpolation factor (e.g., smoothstep or linear)
    const t = easeInOutCubic(progress);

    // Compute interpolated angles
    const currentAngles = startAngles.map((start, idx) => {
      const end = endAngles[idx];
      return start + (end - start) * t;
    });

    onStep(currentAngles);

    if (progress < 1.0) {
      activeAnimationId = requestAnimationFrame(tick);
    } else {
      activeAnimationId = null;
      if (onComplete) onComplete();
    }
  }

  activeAnimationId = requestAnimationFrame(tick);

  return {
    abort: () => {
      aborted = true;
      if (activeAnimationId) {
        cancelAnimationFrame(activeAnimationId);
        activeAnimationId = null;
      }
    }
  };
}

/**
 * Aborts any trajectory currently executing.
 */
export function abortActiveTrajectory() {
  if (activeAnimationId) {
    cancelAnimationFrame(activeAnimationId);
    activeAnimationId = null;
  }
}

// Cubic easing function for smooth acceleration and deceleration
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
