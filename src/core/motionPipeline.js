// src/core/motionPipeline.js
import { COMMAND_TYPES, normalizeCommand } from './commandTypes.js';
import { validateCommand } from './safetyValidator.js';
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

// Local module state
let localKeyConfig = null;

/**
 * Registers the physical/visual robot simulation adapter interface.
 * Wrapper delegation for robotStore registration.
 * 
 * @param {Object} adapter - Visual Three.js robot adapter
 */
export function registerRobotAdapter(adapter) {
  setRobotAdapter(adapter);
  addStatusLog({
    level: "info",
    message: adapter ? "Robot Simulation Adapter registered successfully." : "Robot Simulation Adapter deregistered.",
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
    isMoving: currentState.isMoving,
    safetyTripped: !currentState.safety.lastValid,
    safetyMessage: currentState.safety.lastMessage,
    stopRequested: isStopRequested(),
    hasAdapter: !!getRobotAdapter(),
    hasKeyConfig: !!getKeyConfig()
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
    return { ok: false, message: `Normalization error: ${err.message}`, command };
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
        lastMessage: validation.message
      },
      activeCommand: null
    });

    addStatusLog({
      level: "error",
      message: `Safety Block: ${validation.message}`,
      source: normalized.source,
      commandType: normalized.type
    });

    return { 
      ok: false, 
      message: `Safety Violation: ${validation.message}`, 
      command: normalized 
    };
  }

  // Clear previous safety errors on successful validation check
  setRobotState({
    safety: {
      lastValid: true,
      lastMessage: "Ready"
    }
  });

  // 5. Dispatch command to execution pipeline
  return await executeValidatedCommand(normalized, context);
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

  // Log accepted state
  addStatusLog({
    level: "info",
    message: `Accepted command type [${type}] from [${source}].`,
    source,
    commandType: type
  });

  let result = { ok: true, message: "" };

  switch (type) {
    case COMMAND_TYPES.STOP:
      stopMotion();
      result = { ok: true, message: "Stop command registered. Motion pipeline halted." };
      break;

    case COMMAND_TYPES.HOME:
      clearStopRequest();
      addStatusLog({
        level: "success",
        message: "Robot home command completed. (Actual hardware return pending Phase B)",
        source,
        commandType: type
      });
      result = { ok: true, message: "Home coordinates accepted. Movement pending implementation." };
      break;

    case COMMAND_TYPES.JOG:
      result = { 
        ok: true, 
        message: `Jog command validated: axis '${command.axis}', delta ${command.delta}m.`,
        pendingImplementation: true 
      };
      break;

    case COMMAND_TYPES.MOVE_TO:
      result = { 
        ok: true, 
        message: `MoveTo command validated: target (${command.target.x}, ${command.target.y}, ${command.target.z}).`,
        pendingImplementation: true 
      };
      break;

    case COMMAND_TYPES.PRESS_KEY:
      result = { 
        ok: true, 
        message: `PressKey command validated: target key '${command.key}'.`,
        pendingImplementation: true 
      };
      break;

    case COMMAND_TYPES.RUN_PIN:
      result = { 
        ok: true, 
        message: `RunPin command validated: 6-digit sequence '${command.pin}'.`,
        pendingImplementation: true 
      };
      break;

    case COMMAND_TYPES.ROTATE_JOINT:
      result = { 
        ok: true, 
        message: `RotateJoint command validated: joint '${command.jointName}', rotation ${command.deltaDeg}°.`,
        pendingImplementation: true 
      };
      break;

    default:
      result = { ok: false, message: `Unsupported command handler: ${type}` };
      break;
  }

  // Reset activeCommand in store on completion/acknowledgement of execution
  setRobotState({ activeCommand: null });

  if (result.ok) {
    addStatusLog({
      level: "success",
      message: result.message,
      source,
      commandType: type
    });
  }

  return result;
}
