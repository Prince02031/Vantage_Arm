// src/core/safetyValidator.js

/**
 * Limit parameters representing physical boundaries of the 6-DOF arm.
 * These will be populated from URDF parse results in Phase B.
 */
export const SafetyLimits = {
  // Safe workspace bounds (meters)
  workspace: {
    minX: 0.1,
    maxX: 0.8,
    minY: -0.8,
    maxY: 0.8,
    minZ: 0.0, // Prevent the stylus tip from going below table level
    maxZ: 0.9,
    maxRadius: 0.85 // Max reach spherical limit
  },
  
  // Joint angle boundaries (radians)
  joints: [
    { min: -Math.PI, max: Math.PI },       // Joint 1: Base Rotation
    { min: -Math.PI / 2, max: Math.PI / 2 }, // Joint 2: Shoulder Pitch
    { min: -Math.PI / 2, max: Math.PI / 2 }, // Joint 3: Elbow Pitch
    { min: -Math.PI, max: Math.PI },       // Joint 4: Wrist Roll
    { min: -Math.PI / 2, max: Math.PI / 2 }, // Joint 5: Wrist Pitch
    { min: -Math.PI, max: Math.PI }        // Joint 6: Wrist Yaw
  ]
};

/**
 * Validates a proposed state change before it is executed.
 * Checks Cartesian reachability and joint limits.
 * 
 * @param {Array<number>} proposedAngles - List of 6 joint angles in radians
 * @param {Object} proposedEE - Proposed Cartesian end-effector coordinates {x, y, z}
 * @returns {Object} Validation result { valid: boolean, error: string | null }
 */
export function validateMotion(proposedAngles, proposedEE) {
  // 1. Validate Joint Limits
  for (let i = 0; i < proposedAngles.length; i++) {
    const angle = proposedAngles[i];
    const limit = SafetyLimits.joints[i];
    if (angle < limit.min || angle > limit.max) {
      return {
        valid: false,
        error: `Joint ${i + 1} angle (${angle.toFixed(3)} rad) out of bounds [${limit.min}, ${limit.max}]`
      };
    }
  }

  // 2. Validate Workspace Cartesian Bounds (Table Collision)
  const { x, y, z } = proposedEE;
  const limits = SafetyLimits.workspace;

  if (z < limits.minZ) {
    return {
      valid: false,
      error: `Stylus height (${z.toFixed(3)}m) violates floor boundary (${limits.minZ}m)`
    };
  }

  const radius = Math.sqrt(x * x + y * y + z * z);
  if (radius > limits.maxRadius) {
    return {
      valid: false,
      error: `Target radius (${radius.toFixed(3)}m) exceeds maximum physical reach (${limits.maxRadius}m)`
    };
  }

  if (x < limits.minX || x > limits.maxX || y < limits.minY || y > limits.maxY || z > limits.maxZ) {
    return {
      valid: false,
      error: `Target position (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) is outside allowed workspace box`
    };
  }

  return { valid: true, error: null };
}
