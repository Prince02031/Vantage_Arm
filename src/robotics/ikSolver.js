// src/robotics/ikSolver.js
import { Vector3, Matrix4 } from '../utils/math3d.js';

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
 * Physical dimensions and parameters of the serial arm links.
 */
export const KINEMATIC_CHAIN = [
  { name: "joint_1", origin: [0, 0, 0.06], axis: [0, 0, 1], limit: { min: -3.1416, max: 3.1416 } },
  { name: "joint_2", origin: [0, 0, 0.25], axis: [0, 1, 0], limit: { min: -2.0944, max: 2.0944 } },
  { name: "joint_3", origin: [0, 0, 0.25], axis: [0, 1, 0], limit: { min: -2.6180, max: 2.6180 } },
  { name: "joint_4", origin: [0, 0, 0.25], axis: [0, 0, 1], limit: { min: -3.1416, max: 3.1416 } },
  { name: "joint_5", origin: [0, 0, 0.15], axis: [0, 1, 0], limit: { min: -2.0944, max: 2.0944 } },
  { name: "joint_6", origin: [0, 0, 0.25], axis: [0, 0, 1], limit: { min: -3.1416, max: 3.1416 } },
  { name: "stylus_pitch", origin: [0, 0, 0.15], axis: [0, 1, 0], limit: { min: -2.0944, max: 2.0944 } }
];

export const TIP_OFFSET = [0, 0, 0.137];

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
  
  // Assume a default maximum physical reach of 1.6m unless specified otherwise
  const maxReach = options.maxReach || 1.6;
  const minReach = options.minReach || 0.10;

  return distance >= minReach && distance <= maxReach;
}

/**
 * Computes the forward kinematics positions and axes along the serial link chain.
 * 
 * @param {Object} angles - Map of current joint angles
 * @returns {Object} FK result containing tip position, jointPositions, and jointAxes
 */
export function computeForwardKinematics(angles) {
  let T_accum = new Matrix4().identity();
  const jointPositions = [];
  const jointAxes = [];

  for (let i = 0; i < KINEMATIC_CHAIN.length; i++) {
    const joint = KINEMATIC_CHAIN[i];
    const angle = angles[joint.name] !== undefined ? angles[joint.name] : 0;

    // Translation to current joint
    const T_trans = new Matrix4().makeTranslation(joint.origin[0], joint.origin[1], joint.origin[2]);
    T_accum.multiply(T_trans);
    
    // Store joint position
    const jointPos = T_accum.getPosition();
    jointPositions.push(jointPos);

    // Direction vector of the joint axis in world coordinates
    const localAxis = new Vector3(joint.axis[0], joint.axis[1], joint.axis[2]);
    const e = T_accum.elements;
    const worldAxis = new Vector3(
      e[0] * localAxis.x + e[4] * localAxis.y + e[8] * localAxis.z,
      e[1] * localAxis.x + e[5] * localAxis.y + e[9] * localAxis.z,
      e[2] * localAxis.x + e[6] * localAxis.y + e[10] * localAxis.z
    ).normalize();
    jointAxes.push(worldAxis);

    // Apply joint rotation
    const T_rot = new Matrix4().makeRotationAxis(localAxis, angle);
    T_accum.multiply(T_rot);
  }

  // Translate to end effector tip
  const T_tip = new Matrix4().makeTranslation(TIP_OFFSET[0], TIP_OFFSET[1], TIP_OFFSET[2]);
  T_accum.multiply(T_tip);
  const tipPos = T_accum.getPosition();

  return {
    tip: tipPos,
    jointPositions,
    jointAxes
  };
}

/**
 * Solves Inverse Kinematics for a given coordinate.
 * Attempts to solve using the 3D visual adapter temporarily if ready, otherwise
 * falls back to the analytical model CCD solver.
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
      message: `IK Failed: Target (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}) exceeds physical reach.`,
      target
    });
  }

  const adapterJoints = robotAdapter.getMovableJoints() || [];
  const adapterAngles = robotAdapter.getJointAngles() || {};
  const adapterLimits = robotAdapter.getJointLimits() || {};

  // Check if adapter reports non-zero position to verify it's active
  const initialAngles = { ...adapterAngles };
  robotAdapter.setJointAngles(initialAngles);
  const testEE = robotAdapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
  const isAdapterReady = (testEE.x !== 0 || testEE.y !== 0 || testEE.z !== 0);

  const targetVec = new Vector3(target.x, target.y, target.z);
  let currentErr = Infinity;
  let iterations = 0;
  let solved = false;
  const solvedAngles = {};

  const { maxIterations, toleranceM, stepScale } = settings;

  const attempts = [
    { perturb: false },
    { perturb: true, sign: 1 },
    { perturb: true, sign: -1 }
  ];

  for (const attempt of attempts) {
    solved = false;

    // Reset/initialize solvedAngles map for this attempt
    adapterJoints.forEach(j => {
      const name = typeof j === 'string' ? j : j.name;
      let angle = adapterAngles[name] !== undefined ? adapterAngles[name] : 0.0;
      if (attempt.perturb) {
        // Perturb the pitch joints (rotating around Y)
        const pitchJoints = ["joint_2", "joint_3", "joint_5", "stylus_pitch"];
        const idx = pitchJoints.indexOf(name);
        if (idx !== -1) {
          const factor = idx % 2 === 0 ? 1 : -1;
          angle += attempt.sign * factor * 0.15;
        }
      }
      solvedAngles[name] = angle;
    });

    if (isAdapterReady) {
      // === METHOD A: Gradient Descent using Visual Adapter ===
      const getPositionForAngles = (angles) => {
        robotAdapter.setJointAngles(angles);
        const ee = robotAdapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
        return new Vector3(ee.x, ee.y, ee.z);
      };

      const delta = 0.0005; // tiny angle perturbation
      const step = stepScale * 0.2; // optimization learning step

      for (let i = 0; i < maxIterations; i++) {
        iterations++;
        const currentEE = getPositionForAngles(solvedAngles);
        currentErr = currentEE.distanceTo(targetVec);

        if (currentErr <= toleranceM) {
          solved = true;
          break;
        }

        // Compute numerical gradient for each movable joint
        const grad = {};
        for (const j of adapterJoints) {
          const jointName = typeof j === 'string' ? j : j.name;
          const originalAngle = solvedAngles[jointName] || 0;

          // Forward step
          solvedAngles[jointName] = originalAngle + delta;
          const eePlus = getPositionForAngles(solvedAngles);
          const errPlus = eePlus.distanceTo(targetVec);

          // Backward step
          solvedAngles[jointName] = originalAngle - delta;
          const eeMinus = getPositionForAngles(solvedAngles);
          const errMinus = eeMinus.distanceTo(targetVec);

          // Restore
          solvedAngles[jointName] = originalAngle;

          // Symmetric gradient
          grad[jointName] = (errPlus - errMinus) / (2 * delta);
        }

        // Update angles along negative gradient direction
        for (const j of adapterJoints) {
          const jointName = typeof j === 'string' ? j : j.name;
          const g = grad[jointName] || 0;
          let nextAngle = (solvedAngles[jointName] || 0) - step * g;

          // Respect limit boundaries
          const limit = adapterLimits[jointName] || {};
          const minVal = limit.min !== undefined ? limit.min : (limit.lower !== undefined ? limit.lower : -Math.PI);
          const maxVal = limit.max !== undefined ? limit.max : (limit.upper !== undefined ? limit.upper : Math.PI);
          if (typeof minVal === "number" && typeof maxVal === "number") {
            nextAngle = Math.max(minVal, Math.min(maxVal, nextAngle));
          }

          solvedAngles[jointName] = nextAngle;
        }
      }

      // Restore the original state of the robot so it doesn't glitch during optimization
      robotAdapter.setJointAngles(initialAngles);
    } else {
      // === METHOD B: Analytical Model CCD Solver Fallback ===
      for (let i = 0; i < maxIterations; i++) {
        iterations++;
        const fk = computeForwardKinematics(solvedAngles);
        currentErr = fk.tip.distanceTo(targetVec);

        if (currentErr <= toleranceM) {
          solved = true;
          break;
        }

        for (let j = KINEMATIC_CHAIN.length - 1; j >= 0; j--) {
          const joint = KINEMATIC_CHAIN[j];
          const jointName = joint.name;

          if (!adapterJoints.includes(jointName)) {
            continue;
          }

          const fkStep = computeForwardKinematics(solvedAngles);
          const jointPos = fkStep.jointPositions[j];
          const jointAxis = fkStep.jointAxes[j];
          const currentTip = fkStep.tip;

          const rTip = new Vector3().subVectors(currentTip, jointPos);
          const rTarget = new Vector3().subVectors(targetVec, jointPos);

          const rTipProj = rTip.clone().subVectors(rTip, jointAxis.clone().set(
            jointAxis.x * rTip.dot(jointAxis),
            jointAxis.y * rTip.dot(jointAxis),
            jointAxis.z * rTip.dot(jointAxis)
          ));
          
          const rTargetProj = rTarget.clone().subVectors(rTarget, jointAxis.clone().set(
            jointAxis.x * rTarget.dot(jointAxis),
            jointAxis.y * rTarget.dot(jointAxis),
            jointAxis.z * rTarget.dot(jointAxis)
          ));

          if (rTipProj.length() < 0.0001 || rTargetProj.length() < 0.0001) {
            continue;
          }

          rTipProj.normalize();
          rTargetProj.normalize();

          const cosAngle = rTipProj.dot(rTargetProj);
          const sinAngleVec = new Vector3().crossVectors(rTipProj, rTargetProj);
          const sinAngle = sinAngleVec.dot(jointAxis);
          
          const deltaTheta = Math.atan2(sinAngle, cosAngle);

          solvedAngles[jointName] += deltaTheta * stepScale;

          const limit = adapterLimits[jointName] || joint.limit;
          solvedAngles[jointName] = Math.max(limit.min, Math.min(limit.max, solvedAngles[jointName]));
        }
      }
    }

    // Verify error and solved state at the end of this attempt
    let finalErrCheck = currentErr;
    if (isAdapterReady) {
      robotAdapter.setJointAngles(solvedAngles);
      const finalEE = robotAdapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
      finalErrCheck = new Vector3(finalEE.x, finalEE.y, finalEE.z).distanceTo(targetVec);
      robotAdapter.setJointAngles(initialAngles);
    } else {
      const finalFK = computeForwardKinematics(solvedAngles);
      finalErrCheck = finalFK.tip.distanceTo(targetVec);
    }

    if (finalErrCheck <= toleranceM) {
      solved = true;
      currentErr = finalErrCheck;
      break;
    }
  }

  if (solved) {
    return createIKResult(true, {
      solved: true,
      jointAngles: solvedAngles,
      errorM: currentErr,
      iterations,
      message: `IK solved successfully in ${iterations} iterations. (error: ${(currentErr * 1000).toFixed(2)}mm)`,
      target
    });
  } else {
    return createIKResult(false, {
      solved: false,
      jointAngles: solvedAngles,
      errorM: currentErr,
      iterations,
      message: `IK failed to converge. Target unreachable or limits blocked path. (error: ${(currentErr * 1000).toFixed(2)}mm)`,
      target
    });
  }
}
