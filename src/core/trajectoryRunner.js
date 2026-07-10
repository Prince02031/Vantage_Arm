// src/core/trajectoryRunner.js
import { 
  isStopRequested, 
  clearStopRequest, 
  setRobotState, 
  addStatusLog,
  setActiveTrajectory,
  requestStop
} from './robotStore.js';

let activeAnimationId = null;
let activeResolve = null;

/**
 * Creates a joint trajectory structure.
 * 
 * @param {Object} startAngles - Map of start joint angles { joint_1: val, ... }
 * @param {Object} endAngles - Map of target joint angles { joint_1: val, ... }
 * @param {Object} [options={}] - Trajectory preferences
 * @param {number} [options.durationMs=1000] - Duration in milliseconds
 * @param {number} [options.steps=50] - Number of discrete segments
 * @returns {Object} Structured jointTrajectory object
 */
export function createJointTrajectory(startAngles, endAngles, options = {}) {
  const durationMs = options.durationMs || 1000;
  const steps = options.steps || 50;

  return {
    id: "traj_" + String(Date.now()) + Math.random().toString(36).substring(2, 7),
    type: "jointTrajectory",
    startAngles: { ...startAngles },
    endAngles: { ...endAngles },
    durationMs,
    steps,
    createdAt: Date.now()
  };
}

/**
 * Linearly interpolates between start and end joint angles.
 * Handles missing joint names gracefully by keeping their values unchanged.
 * 
 * @param {Object} startAngles - Map of starting joint angles
 * @param {Object} endAngles - Map of target joint angles
 * @param {number} t - Interpolation factor between 0.0 and 1.0
 * @returns {Object} Map of interpolated joint angles
 */
export function interpolateJointAngles(startAngles, endAngles, t) {
  const result = {};
  const starts = startAngles || {};
  const ends = endAngles || {};
  
  const allJoints = new Set([...Object.keys(starts), ...Object.keys(ends)]);

  allJoints.forEach(jointName => {
    const startVal = starts[jointName] !== undefined ? starts[jointName] : (ends[jointName] ?? 0.0);
    const endVal = ends[jointName] !== undefined ? ends[jointName] : (starts[jointName] ?? 0.0);
    
    // Linear interpolation equation
    result[jointName] = startVal + (endVal - startVal) * t;
  });

  return result;
}

/**
 * Runs a trajectory on the robot model using requestAnimationFrame.
 * Checks for stop requests at each step and writes interpolated states to robotStore.
 * 
 * @param {Object} trajectory - The jointTrajectory object to execute
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @param {Object} [options={}] - Execution overrides
 * @returns {Promise<Object>} Execution report { ok: boolean, message: string }
 */
export function runTrajectory(trajectory, robotAdapter, options = {}) {
  // Cancel any running animations
  if (activeAnimationId) {
    cancelActiveTrajectory();
  }

  return new Promise((resolve) => {
    activeResolve = resolve;
    
    if (!trajectory || trajectory.type !== "jointTrajectory") {
      return resolve({ ok: false, message: "Invalid trajectory object." });
    }

    const { startAngles, endAngles, durationMs } = trajectory;
    const startTime = performance.now();

    setRobotState({ isMoving: true });
    setActiveTrajectory(trajectory);
    clearStopRequest();

    addStatusLog({
      level: "info",
      message: `Executing trajectory (${durationMs}ms duration)...`,
      source: "trajectory"
    });

    function step(now) {
      // 1. Check for immediate operator stop request
      if (isStopRequested()) {
        cleanup();
        clearStopRequest();
        addStatusLog({
          level: "warning",
          message: "Trajectory execution aborted: Operator stop requested.",
          source: "trajectory"
        });
        resolve({ ok: false, message: "Trajectory cancelled by operator request." });
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);

      // Smooth step easing
      const t = easeInOutCubic(progress);

      // 2. Interpolate joint positions
      const currentAngles = interpolateJointAngles(startAngles, endAngles, t);

      // 3. Update adapter visual state
      if (robotAdapter && typeof robotAdapter.setJointAngles === "function") {
        try {
          robotAdapter.setJointAngles(currentAngles);
        } catch (err) {
          console.error("Failed to set joint angles in adapter:", err);
        }
      }

      // 4. Update the state store
      const stateUpdate = {
        jointAngles: currentAngles,
        isMoving: true
      };

      if (robotAdapter && typeof robotAdapter.getEndEffectorPosition === "function") {
        try {
          const currentEE = robotAdapter.getEndEffectorPosition();
          if (currentEE) {
            stateUpdate.endEffectorPosition = { x: currentEE.x, y: currentEE.y, z: currentEE.z };
          }
        } catch (err) {}
      }

      setRobotState(stateUpdate);

      if (progress < 1.0) {
        activeAnimationId = requestAnimationFrame(step);
      } else {
        // Complete trajectory execution
        cleanup();

        // Final sync of end effector position on completion
        const finalUpdate = { isMoving: false };
        if (robotAdapter && typeof robotAdapter.getEndEffectorPosition === "function") {
          try {
            const finalEE = robotAdapter.getEndEffectorPosition();
            if (finalEE) {
              finalUpdate.endEffectorPosition = { x: finalEE.x, y: finalEE.y, z: finalEE.z };
            }
          } catch (err) {}
        }
        setRobotState(finalUpdate);

        addStatusLog({
          level: "success",
          message: "Trajectory execution completed successfully.",
          source: "trajectory"
        });
        resolve({ ok: true, message: "Trajectory completed." });
      }
    }

    activeAnimationId = requestAnimationFrame(step);
  });
}

/**
 * Triggers a cancel request for the active running trajectory.
 */
export function cancelActiveTrajectory() {
  requestStop();
}

/**
 * Indicates if a trajectory is actively being executed by the runner.
 * 
 * @returns {boolean} True if running
 */
export function isTrajectoryRunning() {
  return activeAnimationId !== null;
}

// Utility cleanup function
function cleanup() {
  if (activeAnimationId) {
    cancelAnimationFrame(activeAnimationId);
    activeAnimationId = null;
  }
  setRobotState({ isMoving: false });
  setActiveTrajectory(null);
  activeResolve = null;
}

// Cubic easing for acceleration and deceleration profile
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
