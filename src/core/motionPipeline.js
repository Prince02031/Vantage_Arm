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
import { pressKey, runPin } from './pinRunner.js';

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
      joints.forEach(name => {
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

      const endAngles = { ...startAngles, [command.jointName]: targetAngle };
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

      // 1. Validate target workspace coordinate bounds
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

      // Update target marker position if supported by adapter
      if (adapter && typeof adapter.setTargetMarkerPosition === "function") {
        try {
          adapter.setTargetMarkerPosition(targetPos);
        } catch (err) {}
      }

      // 2. Solve Inverse Kinematics
      const ikResult = solveIK(targetPos, adapter);
      if (!ikResult.solved) {
        result = { 
          ok: false, 
          message: `Jog movement failed: ${ikResult.message}`, 
          command, 
          data: ikResult 
        };
        break;
      }

      // 3. Execute path movement
      const startAngles = adapter.getJointAngles() || {};
      const trajectory = createJointTrajectory(startAngles, ikResult.jointAngles, { durationMs: 800 });

      addStatusLog({
        level: "info",
        message: `Jogging stylus along '${command.axis}' axis by ${command.delta}m...`,
        source,
        commandType: type
      });

      const runnerRes = await runTrajectory(trajectory, adapter);
      
      if (runnerRes.ok) {
        setRobotState({ 
          targetPosition: targetPos,
          endEffectorPosition: targetPos
        });
      }

      result = { 
        ok: runnerRes.ok, 
        message: runnerRes.ok ? `Jog completed: ${runnerRes.message}` : runnerRes.message, 
        command, 
        data: runnerRes 
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

      // Update target marker position if supported by adapter
      if (adapter && typeof adapter.setTargetMarkerPosition === "function") {
        try {
          adapter.setTargetMarkerPosition(command.target);
        } catch (err) {}
      }

      // Solve Inverse Kinematics
      const ikResult = solveIK(command.target, adapter);
      if (!ikResult.solved) {
        result = { 
          ok: false, 
          message: `MoveTo solver failed: ${ikResult.message}`, 
          command, 
          data: ikResult 
        };
        break;
      }

      // Execute path movement
      const startAngles = adapter.getJointAngles() || {};
      const trajectory = createJointTrajectory(startAngles, ikResult.jointAngles, { durationMs: 1200 });

      addStatusLog({
        level: "info",
        message: `Moving stylus to coordinate (${command.target.x.toFixed(3)}, ${command.target.y.toFixed(3)}, ${command.target.z.toFixed(3)})...`,
        source,
        commandType: type
      });

      const runnerRes = await runTrajectory(trajectory, adapter);
      
      if (runnerRes.ok) {
        setRobotState({ 
          targetPosition: command.target,
          endEffectorPosition: command.target
        });
      }

      result = { 
        ok: runnerRes.ok, 
        message: runnerRes.ok ? `MoveTo completed: ${runnerRes.message}` : runnerRes.message, 
        command, 
        data: runnerRes 
      };
      break;
    }

    case COMMAND_TYPES.PRESS_KEY: {
      // Planning phase output for Phase B
      const pressRes = pressKey(command.key, context);
      result = {
        ok: pressRes.ok,
        message: pressRes.message,
        command,
        data: pressRes,
        pendingImplementation: pressRes.pendingImplementation
      };
      break;
    }

    case COMMAND_TYPES.RUN_PIN: {
      // Planning phase output for Phase B
      const pinRes = runPin(command.pin, context);
      result = {
        ok: pinRes.ok,
        message: pinRes.message,
        command,
        data: pinRes,
        pendingImplementation: pinRes.pendingImplementation
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
