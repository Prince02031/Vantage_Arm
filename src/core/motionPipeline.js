// src/core/motionPipeline.js
import { COMMAND_TYPES, normalizeCommand } from './commandTypes.js';
import { validateCommand, validateWorkspace } from './safetyValidator.js';
import { 
  getRobotState, 
  setRobotState, 
  addStatusLog, 
  getRobotAdapter, 
  setRobotAdapter, 
  requestStop, 
  clearStopRequest, 
  isStopRequested 
} from './robotStore.js';
import { 
  createJointTrajectory, 
  runTrajectory, 
  cancelActiveTrajectory 
} from './trajectoryRunner.js';
import { solveIK } from '../robotics/ikSolver.js';
import { pressKey, runPin, buildKeyPressTargets, validatePinAgainstConfig } from './pinRunner.js';

// Local module state for key coordinates config
let localKeyConfig = null;

/**
 * Registers the physical/visual robot simulation adapter interface.
 * Wrapper delegation for robotStore registration.
 * 
 * @param {Object} adapter - Visual Three.js robot adapter
 */
export function registerRobotAdapter(adapter) {
  setRobotAdapter(adapter);
  
  if (adapter) {
    // Read starting joints/limits to configure the store
    try {
      const movableJoints = adapter.getMovableJoints() || [];
      const jointLimits = adapter.getJointLimits() || {};
      const jointAngles = adapter.getJointAngles() || {};
      const endEffectorPosition = adapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
      
      setRobotState({
        movableJoints,
        jointLimits,
        jointAngles,
        endEffectorPosition
      });
    } catch (err) {
      console.error("Failed to extract initial joint states from adapter:", err);
    }
  }

  addStatusLog({
    level: "info",
    message: adapter ? "Robot Simulation Adapter registered and synced." : "Robot Simulation Adapter deregistered.",
    source: "pipeline"
  });
}

/**
 * Sets the 6-key panel coordinates config.
 * 
 * @param {Object} config - key.config.json coordinates object
 */
export function setKeyConfig(config) {
  localKeyConfig = config;
  addStatusLog({
    level: "info",
    message: config ? "Key coordinate configuration loaded." : "Key configuration cleared.",
    source: "pipeline"
  });
}

/**
 * Retrieves the currently loaded key coordinates config.
 * 
 * @returns {Object|null} Active coordinate config
 */
export function getKeyConfig() {
  return localKeyConfig;
}

/**
 * Immediately flags a stop request to halt active movements.
 */
export function stopMotion() {
  requestStop();
  cancelActiveTrajectory();
  setRobotState({ isMoving: false });
  addStatusLog({
    level: "warning",
    message: "Motion pipeline stop request registered. All motion halted.",
    source: "pipeline"
  });
}

/**
 * Retrieves the high-level operational status of the motion pipeline.
 * Useful for UI panels (SafetyPanel, Dashboard) to assess readiness.
 * 
 * @returns {Object} Pipeline status report
 */
export function getPipelineStatus() {
  const currentState = getRobotState();
  return {
    adapter: getRobotAdapter() ? "registered" : "missing",
    activeCommand: currentState.activeCommand,
    isMoving: currentState.isMoving,
    lastSafetyResult: currentState.safety.lastSafetyResult || null,
    stopRequested: isStopRequested()
  };
}

/**
 * Central entrypoint for all command execution requests.
 * Standardizes inputs, handles logging, validates constraints, and executes/delegates commands.
 * 
 * @param {Object} command - Raw command input
 * @param {Object} [options={}] - Custom options
 * @returns {Promise<Object>} Execution result containing success status and explanation
 */
export async function executeCommand(command, options = {}) {
  let normalized;

  // 1. Normalize command to standard schema
  try {
    normalized = normalizeCommand(command);
  } catch (err) {
    addStatusLog({
      level: "error",
      message: `Command normalization failed: ${err.message}`,
      source: command?.source || "unknown"
    });
    return { ok: false, message: `Normalization error: ${err.message}`, command, data: null };
  }

  // Log incoming request
  addStatusLog({
    level: "info",
    message: `Received command type [${normalized.type}] from [${normalized.source}].`,
    source: normalized.source,
    commandType: normalized.type
  });

  // Check if safety is currently tripped
  const currentState = getRobotState();
  const isTripped = !currentState.safety.lastValid;
  if (isTripped && 
      normalized.type !== COMMAND_TYPES.STOP && 
      normalized.type !== "resetSafety" && 
      normalized.type !== "reset" && 
      normalized.type !== "halt") {
    
    addStatusLog({
      level: "error",
      message: `Command [${normalized.type}] rejected: System is in a tripped safety state. Please reset safety first.`,
      source: normalized.source,
      commandType: normalized.type
    });
    return {
      ok: false,
      message: `Safety Violation: System is tripped. Reset required.`,
      command: normalized,
      data: null
    };
  }

  // 2. Set as active command in the store
  setRobotState({ activeCommand: normalized });

  // 3. Prepare validation context
  const context = {
    robotAdapter: getRobotAdapter(),
    keyConfig: getKeyConfig()
  };

  // 4. Validate command constraints
  const validation = validateCommand(normalized, context);

  if (!validation.ok) {
    // Flag safety violation in the store
    setRobotState({
      safety: {
        lastValid: false,
        lastMessage: validation.message,
        lastSafetyResult: validation
      },
      activeCommand: null
    });

    addStatusLog({
      level: "error",
      message: `Safety Blocked command [${normalized.type}]: ${validation.message}`,
      source: normalized.source,
      commandType: normalized.type
    });

    return { 
      ok: false, 
      message: `Safety Violation: ${validation.message}`, 
      command: normalized,
      data: validation
    };
  }

  // Clear previous safety errors on successful validation check
  setRobotState({
    safety: {
      lastValid: true,
      lastMessage: "Ready",
      lastSafetyResult: validation
    }
  });

  // 5. Dispatch command to execution pipeline
  try {
    const result = await executeValidatedCommand(normalized, context);
    return result;
  } catch (err) {
    addStatusLog({
      level: "error",
      message: `Execution failed internally: ${err.message}`,
      source: normalized.source,
      commandType: normalized.type
    });
    setRobotState({ activeCommand: null, isMoving: false });
    return { ok: false, message: `Internal error: ${err.message}`, command: normalized, data: null };
  }
}

/**
 * Shared helper to move the arm to a Cartesian target.
 * Solves IK, updates target marker, runs trajectory, and logs final error.
 * 
 * @param {Object} target - Cartesian coordinate { x, y, z }
 * @param {Object} adapter - Robot simulation adapter
 * @param {string} source - Origin of command
 * @param {string} type - Command type (e.g. 'moveTo', 'jog')
 * @returns {Promise<Object>} Result containing ok, message, data
 */
export async function moveToTarget(target, adapter, source, type) {
  if (!adapter) {
    return { ok: false, message: "No robot simulation adapter registered.", data: null };
  }

  // Update target marker
  if (typeof adapter.updateTargetMarker === "function") {
    try {
      adapter.updateTargetMarker(target);
    } catch (err) {
      console.error("Failed to update target marker:", err);
    }
  }

  // Solve Inverse Kinematics
  const ikResult = solveIK(target, adapter);
  
  // Update state with IK status and target
  setRobotState({
    targetPosition: target,
    safety: {
      ...getRobotState().safety,
      ikSolved: ikResult.solved,
      ikError: ikResult.errorM
    }
  });

  if (!ikResult.solved) {
    return {
      ok: false,
      message: `IK solver failed to converge: ${ikResult.message}`,
      data: ikResult
    };
  }

  // Execute path movement
  const startAngles = adapter.getJointAngles() || {};
  const trajectory = createJointTrajectory(startAngles, ikResult.jointAngles, { durationMs: 1200 });

  addStatusLog({
    level: "info",
    message: `Moving stylus to target (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}). Solver error: ${ikResult.errorM?.toFixed(4)}m.`,
    source,
    commandType: type
  });

  const runnerRes = await runTrajectory(trajectory, adapter);

  // Read current position after movement
  const finalPos = adapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
  const finalErr = Math.sqrt(
    Math.pow(finalPos.x - target.x, 2) +
    Math.pow(finalPos.y - target.y, 2) +
    Math.pow(finalPos.z - target.z, 2)
  );

  addStatusLog({
    level: runnerRes.ok ? "success" : "error",
    message: `Move completed. Final distance error: ${finalErr.toFixed(4)}m.`,
    source,
    commandType: type
  });

  if (runnerRes.ok) {
    setRobotState({
      endEffectorPosition: finalPos
    });
  }

  return {
    ok: runnerRes.ok,
    message: runnerRes.ok ? `Trajectory executed successfully. Error: ${finalErr.toFixed(4)}m.` : runnerRes.message,
    data: { runnerRes, finalErr, jointAngles: ikResult.jointAngles }
  };
}

/**
 * Executes a full key press movement sequence (approach -> touch -> flash -> retreat).
 * 
 * @param {string} key - The digit label "1"-"6"
 * @param {Object} context - Pipeline context containing adapter and config
 * @param {Object} command - Original command details
 * @returns {Promise<Object>} Execution result
 */
export async function executePressKey(key, context, command) {
  const adapter = context.robotAdapter;
  if (!adapter) {
    return { ok: false, message: "PressKey rejected: No robot simulation adapter registered.", command, data: null };
  }

  // Load key configuration
  const keyConfig = getKeyConfig();
  if (!keyConfig) {
    return { ok: false, message: "PressKey rejected: Key configuration not loaded.", command, data: null };
  }

  const strKey = String(key);
  let targets;
  try {
    targets = buildKeyPressTargets(strKey, keyConfig);
  } catch (err) {
    return { ok: false, message: `PressKey rejected: ${err.message}`, command, data: null };
  }

  const { approach, touch, retreat } = targets;

  addStatusLog({
    level: "info",
    message: `Starting pressKey sequence for Key [${strKey}].`,
    source: "pressKey",
    commandType: COMMAND_TYPES.PRESS_KEY
  });

  // Step 1: Move to approach position
  addStatusLog({
    level: "info",
    message: `Step 1/3: Moving to approach point above Key [${strKey}] at (${approach.x.toFixed(3)}, ${approach.y.toFixed(3)}, ${approach.z.toFixed(3)})...`,
    source: "pressKey"
  });
  const approachRes = await moveToTarget(approach, adapter, "pressKey", COMMAND_TYPES.PRESS_KEY);
  if (!approachRes.ok) {
    return { ok: false, message: `PressKey failed at approach step: ${approachRes.message}`, command, data: approachRes.data };
  }

  // Step 2: Move to touch position
  addStatusLog({
    level: "info",
    message: `Step 2/3: Moving to touch point on Key [${strKey}] at (${touch.x.toFixed(3)}, ${touch.y.toFixed(3)}, ${touch.z.toFixed(3)})...`,
    source: "pressKey"
  });
  const touchRes = await moveToTarget(touch, adapter, "pressKey", COMMAND_TYPES.PRESS_KEY);
  if (!touchRes.ok) {
    // Attempt to retreat anyway to be safe
    await moveToTarget(retreat, adapter, "pressKey", COMMAND_TYPES.PRESS_KEY);
    return { ok: false, message: `PressKey failed at touch step: ${touchRes.message}`, command, data: touchRes.data };
  }

  // Calculate final distance from actual end-effector position to touch target
  const currentPos = adapter.getEndEffectorPosition() || { x: 0, y: 0, z: 0 };
  const distance = Math.sqrt(
    Math.pow(currentPos.x - touch.x, 2) +
    Math.pow(currentPos.y - touch.y, 2) +
    Math.pow(currentPos.z - touch.z, 2)
  );

  const isSuccess = distance <= 0.005; // 5mm tolerance
  
  if (isSuccess) {
    addStatusLog({
      level: "success",
      message: `Key [${strKey}] touched successfully (offset error: ${(distance * 1000).toFixed(2)}mm).`,
      source: "pressKey"
    });
    if (typeof adapter.flashKey === "function") {
      try {
        adapter.flashKey(strKey);
      } catch (err) {
        console.error("Failed to flash key:", err);
      }
    }
  } else {
    addStatusLog({
      level: "warning",
      message: `Key [${strKey}] touch completed with high error: ${(distance * 1000).toFixed(2)}mm.`,
      source: "pressKey"
    });
  }

  // Step 3: Move to retreat position
  addStatusLog({
    level: "info",
    message: `Step 3/3: Retreating to approach point above Key [${strKey}]...`,
    source: "pressKey"
  });
  const retreatRes = await moveToTarget(retreat, adapter, "pressKey", COMMAND_TYPES.PRESS_KEY);
  if (!retreatRes.ok) {
    return { ok: false, message: `PressKey completed touch but failed to retreat: ${retreatRes.message}`, command, data: { touchError: distance } };
  }

  // Update robot store with last key press result
  setRobotState({
    lastKeyPressResult: {
      key: strKey,
      success: isSuccess,
      errorM: distance,
      timestamp: Date.now()
    }
  });

  return {
    ok: isSuccess,
    message: isSuccess
      ? `Key [${strKey}] pressed successfully. Error: ${(distance * 1000).toFixed(2)}mm.`
      : `Key [${strKey}] press completed but distance error ${(distance * 1000).toFixed(2)}mm was outside threshold.`,
    command,
    data: { errorM: distance }
  };
}

/**
 * Executes a pre-validated command. Assumes safety limits have already been checked.
 * 
 * @param {Object} command - Normalized, validated command object
 * @param {Object} context - Validation context containing adapter and config details
 * @returns {Promise<Object>} Execution output
 */
export async function executeValidatedCommand(command, context) {
  const { type, source } = command;
  const adapter = context.robotAdapter;

  let result = { ok: true, message: "", command, data: null };

  switch (type) {
    case COMMAND_TYPES.STOP: {
      stopMotion();
      result = { 
        ok: true, 
        message: "Stop command registered. Motion pipeline halted.", 
        command, 
        data: null 
      };
      break;
    }

    case "resetSafety":
    case "reset": {
      setRobotState({
        safety: {
          lastValid: true,
          lastMessage: "Ready",
          lastSafetyResult: null
        }
      });
      addStatusLog({
        level: "success",
        message: "Safety latch reset successfully. System ready.",
        source
      });
      result = { ok: true, message: "Safety latch reset successfully.", command, data: null };
      break;
    }

    case "halt": {
      stopMotion();
      setRobotState({
        safety: {
          lastValid: false,
          lastMessage: "Emergency Halt activated.",
          lastSafetyResult: { ok: false, message: "Emergency Halt activated." }
        }
      });
      addStatusLog({
        level: "error",
        message: "Emergency Halt triggered. System tripped.",
        source
      });
      result = { ok: true, message: "Emergency Halt activated.", command, data: null };
      break;
    }

    case COMMAND_TYPES.HOME: {
      if (!adapter) {
        result = { 
          ok: false, 
          message: "Home command rejected: No robot simulation adapter registered.", 
          command, 
          data: null 
        };
        break;
      }
      
      clearStopRequest();
      const joints = adapter.getMovableJoints() || [];
      const startAngles = adapter.getJointAngles() || {};
      
      const endAngles = {};
      joints.forEach(j => {
        const name = typeof j === 'string' ? j : j.name;
        endAngles[name] = 0.0;
      });

      const trajectory = createJointTrajectory(startAngles, endAngles, { durationMs: 1500 });
      
      addStatusLog({
        level: "info",
        message: "Initiating return to home (zero joints config)...",
        source,
        commandType: type
      });

      const runnerRes = await runTrajectory(trajectory, adapter);
      
      if (runnerRes.ok && adapter.getEndEffectorPosition) {
        setRobotState({ endEffectorPosition: adapter.getEndEffectorPosition() });
      }

      result = { 
        ok: runnerRes.ok, 
        message: runnerRes.message, 
        command, 
        data: runnerRes 
      };
      break;
    }

    case COMMAND_TYPES.ROTATE_JOINT: {
      if (!adapter) {
        result = { 
          ok: false, 
          message: "RotateJoint rejected: No robot simulation adapter registered.", 
          command, 
          data: null 
        };
        break;
      }

      const startAngles = adapter.getJointAngles() || {};
      const currentAngle = startAngles[command.jointName] || 0.0;
      const deltaRad = (command.deltaDeg * Math.PI) / 180;
      const targetAngle = currentAngle + deltaRad;

      // Respect limits if available
      const limits = adapter.getJointLimits() || {};
      const limit = limits[command.jointName];
      let clampedAngle = targetAngle;
      if (limit) {
        const minVal = limit.min !== undefined ? limit.min : limit.lower;
        const maxVal = limit.max !== undefined ? limit.max : limit.upper;
        if (typeof minVal === 'number' && typeof maxVal === 'number') {
          clampedAngle = Math.max(minVal, Math.min(maxVal, targetAngle));
        }
      }

      const endAngles = { ...startAngles, [command.jointName]: clampedAngle };
      const trajectory = createJointTrajectory(startAngles, endAngles, { durationMs: 800 });

      addStatusLog({
        level: "info",
        message: `Rotating joint '${command.jointName}' by ${command.deltaDeg}°...`,
        source,
        commandType: type
      });

      const runnerRes = await runTrajectory(trajectory, adapter);
      
      if (runnerRes.ok && adapter.getEndEffectorPosition) {
        setRobotState({ endEffectorPosition: adapter.getEndEffectorPosition() });
      }

      result = { 
        ok: runnerRes.ok, 
        message: runnerRes.message, 
        command, 
        data: runnerRes 
      };
      break;
    }

    case COMMAND_TYPES.JOG: {
      if (!adapter) {
        result = { 
          ok: false, 
          message: "Jog rejected: No robot simulation adapter registered.", 
          command, 
          data: null 
        };
        break;
      }

      if (typeof adapter.getEndEffectorPosition !== "function") {
        result = { 
          ok: false, 
          message: "Jog rejected: Robot adapter lacks getEndEffectorPosition method.", 
          command, 
          data: null 
        };
        break;
      }

      const currentPos = adapter.getEndEffectorPosition();
      if (!currentPos) {
        result = { 
          ok: false, 
          message: "Jog rejected: Could not retrieve current stylus tip coordinates.", 
          command, 
          data: null 
        };
        break;
      }

      // Calculate target position
      const targetPos = {
        x: currentPos.x + (command.axis === 'x' ? command.delta : 0),
        y: currentPos.y + (command.axis === 'y' ? command.delta : 0),
        z: currentPos.z + (command.axis === 'z' ? command.delta : 0)
      };

      // Validate target workspace coordinate bounds
      const workspaceCheck = validateWorkspace(targetPos);
      if (!workspaceCheck.ok) {
        result = { 
          ok: false, 
          message: `Jog coordinate rejected: ${workspaceCheck.message}`, 
          command, 
          data: workspaceCheck 
        };
        break;
      }

      // Reuse moveToTarget internally
      const moveRes = await moveToTarget(targetPos, adapter, source, type);
      result = {
        ok: moveRes.ok,
        message: moveRes.message,
        command,
        data: moveRes.data
      };
      break;
    }

    case COMMAND_TYPES.MOVE_TO: {
      if (!adapter) {
        result = { 
          ok: false, 
          message: "MoveTo rejected: No robot simulation adapter registered.", 
          command, 
          data: null 
        };
        break;
      }

      const moveRes = await moveToTarget(command.target, adapter, source, type);
      result = {
        ok: moveRes.ok,
        message: moveRes.message,
        command,
        data: moveRes.data
      };
      break;
    }

    case COMMAND_TYPES.PRESS_KEY: {
      if (!adapter) {
        const pressRes = pressKey(command.key, context);
        result = {
          ok: pressRes.ok,
          message: pressRes.message,
          command,
          data: pressRes,
          pendingImplementation: true
        };
        break;
      }
      const pressRes = await executePressKey(command.key, context, command);
      result = {
        ok: pressRes.ok,
        message: pressRes.message,
        command,
        data: pressRes.data
      };
      break;
    }

    case COMMAND_TYPES.RUN_PIN: {
      const pinRes = await runPin(command.pin, {
        ...context,
        executePressKey: async (digit) => executePressKey(digit, context, command),
        source
      });
      result = {
        ok: pinRes.ok,
        message: pinRes.message,
        command,
        data: pinRes.data || pinRes
      };
      break;
    }

    default:
      result = { ok: false, message: `Unsupported command handler: ${type}`, command, data: null };
      break;
  }

  // Reset activeCommand in store on completion of execution
  setRobotState({ activeCommand: null });

  if (result.ok) {
    addStatusLog({
      level: "success",
      message: result.message,
      source,
      commandType: type
    });
  } else {
    addStatusLog({
      level: "error",
      message: result.message,
      source,
      commandType: type
    });
  }

  return result;
}
