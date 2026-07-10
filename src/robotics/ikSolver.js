// src/robotics/ikSolver.js

/**
 * Standard configuration options for the numerical IK solver.
 * @constant {Object}
 */
export const DEFAULT_IK_OPTIONS = {
  maxIterations: 80,
  toleranceM: 0.005, // 5mm accuracy threshold
  stepScale: 0.5,
  positionOnly: true
};

/**
 * Factory utility to construct a standard IK result object.
 * 
 * @param {boolean} ok - True if solver succeeded or run completed safely
 * @param {Object} [data={}] - Result variables
 * @param {boolean} [data.solved=false] - True if target was mathematically reached within tolerance
 * @param {Object} [data.jointAngles={}] - Solved joint values map
 * @param {number|null} [data.errorM=null] - End distance error in meters
 * @param {number} [data.iterations=0] - Iterations consumed
 * @param {string} [data.message=""] - Solver detail message
 * @param {Object} [data.target=null] - Solved target coordinate {x, y, z}
 * @returns {Object} IKResult
 */
export function createIKResult(ok, data = {}) {
  return {
    ok: !!ok,
    solved: data.solved !== undefined ? !!data.solved : !!ok,
    jointAngles: data.jointAngles || {},
    errorM: data.errorM !== undefined ? data.errorM : null,
    iterations: data.iterations || 0,
    message: data.message || (ok ? "IK calculation succeeded." : "IK calculation failed."),
    target: data.target || null
  };
}

/**
 * Estimates if a Cartesian target coordinate is reachable before launching full IK.
 * 
 * @param {Object} target - Target coordinate {x, y, z}
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @param {Object} [options={}] - Kinematics options
 * @returns {boolean} True if likely reachable
 */
export function estimateReachability(target, robotAdapter, options = {}) {
  if (!target || typeof target.x !== "number" || typeof target.y !== "number" || typeof target.z !== "number") {
    return false;
  }
  
  const distance = Math.sqrt(target.x * target.x + target.y * target.y + target.z * target.z);
  
  // Assume a default maximum physical reach of 0.85m unless specified otherwise
  const maxReach = options.maxReach || 0.85;
  const minReach = options.minReach || 0.10;

  return distance >= minReach && distance <= maxReach;
}

/**
 * Solves Inverse Kinematics for a given coordinate.
 * Phase A behavior: Validates arguments, checks adapter, and returns a structured mock result.
 * 
 * @param {Object} target - Target coordinate {x, y, z}
 * @param {Object} robotAdapter - Visual/physical robot model adapter
 * @param {Object} [options={}] - Kinematics configuration overrides
 * @returns {Object} IKResult
 */
export function solveIK(target, robotAdapter, options = {}) {
  const settings = { ...DEFAULT_IK_OPTIONS, ...options };

  // 1. Validate Target Coordinates
  if (!target || typeof target.x !== "number" || typeof target.y !== "number" || typeof target.z !== "number") {
    return createIKResult(false, {
      message: "IK Failed: Target coordinate is missing or has invalid format.",
      target
    });
  }

  // 2. Validate Robot Adapter presence
  if (!robotAdapter) {
    return createIKResult(false, {
      message: "IK Failed: No active robot adapter registered in store.",
      target
    });
  }

  // 3. Validate Adapter interfaces
  if (typeof robotAdapter.getMovableJoints !== "function" || 
      typeof robotAdapter.getEndEffectorPosition !== "function") {
    return createIKResult(false, {
      message: "IK Failed: Robot adapter lacks required methods (getMovableJoints or getEndEffectorPosition).",
      target
    });
  }

  // 4. Estimate reachability
  const reachable = estimateReachability(target, robotAdapter, settings);
  if (!reachable) {
    return createIKResult(false, {
      solved: false,
      message: `IK Failed: Target (${target.x}, ${target.y}, ${target.z}) exceeds physical workspace reach.`,
      target
    });
  }

  // Phase A Mock Solver placeholder output:
  // In Phase B, this will execute the iterative Jacobian pseudo-inverse loops.
  const joints = robotAdapter.getMovableJoints() || [];
  const mockAngles = {};
  joints.forEach(name => {
    mockAngles[name] = 0.0; // Return mock zero configuration
  });

  return createIKResult(true, {
    solved: false, // Solved is false because solving logic is pending Phase B
    jointAngles: mockAngles,
    errorM: 0.0,
    iterations: 0,
    message: "IK contract validated. Numeric solver pending Phase B implementation.",
    target
  });
}
