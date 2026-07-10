// src/robotics/forwardKinematics.js

/**
 * Retrieves the current end-effector stylus tip coordinate relative to the base.
 * Delegates to the visual robot adapter model.
 * 
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @returns {Object} Cartesian coordinates { x, y, z } in meters
 */
export function getEndEffectorPosition(robotAdapter) {
  if (robotAdapter && typeof robotAdapter.getEndEffectorPosition === "function") {
    try {
      return robotAdapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
    } catch (err) {
      console.error("Error querying end-effector position from adapter:", err);
    }
  }
  return { x: 0, y: 0, z: 0 };
}

/**
 * Retrieves the current joint angles map from the active visual model.
 * 
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @returns {Object} Map of joint names to angles in radians
 */
export function getJointAngles(robotAdapter) {
  if (robotAdapter && typeof robotAdapter.getJointAngles === "function") {
    try {
      return robotAdapter.getJointAngles() || {};
    } catch (err) {
      console.error("Error querying joint angles from adapter:", err);
    }
  }
  return {};
}

/**
 * Retrieves the physical joint limits map from the active visual model.
 * Limits are parsed from the URDF limit tags.
 * 
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @returns {Object} Map of joint names to limit objects { min, max } in radians
 */
export function getJointLimits(robotAdapter) {
  if (robotAdapter && typeof robotAdapter.getJointLimits === "function") {
    try {
      return robotAdapter.getJointLimits() || {};
    } catch (err) {
      console.error("Error querying joint limits from adapter:", err);
    }
  }
  return {};
}

/**
 * Clamps a map of proposed joint angles to fit their physical bounds.
 * 
 * @param {Object} jointAngles - Map of joint names to angles
 * @param {Object} jointLimits - Map of joint names to limits { min, max }
 * @returns {Object} Map of clamped joint angles
 */
export function clampJointAngles(jointAngles, jointLimits) {
  const clamped = {};
  const angles = jointAngles || {};
  const limits = jointLimits || {};

  Object.keys(angles).forEach(name => {
    const angle = angles[name];
    const limit = limits[name];

    if (limit && typeof limit.min === "number" && typeof limit.max === "number") {
      clamped[name] = Math.max(limit.min, Math.min(limit.max, angle));
    } else {
      clamped[name] = angle;
    }
  });

  return clamped;
}

/**
 * Checks if a specific angle is within limits.
 * 
 * @param {number} angle - Angle value in radians
 * @param {Object} limits - Limit boundary object
 * @param {number} limits.min - Minimum allowed angle in radians
 * @param {number} limits.max - Maximum allowed angle in radians
 * @returns {boolean} True if within boundaries
 */
export function angleWithinLimits(angle, limits) {
  if (!limits || typeof limits.min !== "number" || typeof limits.max !== "number") {
    return true;
  }
  return angle >= limits.min && angle <= limits.max;
}
