// src/core/safetyValidator.js
import { 
  COMMAND_TYPES, 
  WORKSPACE_BOUNDS, 
  PIN_REGEX, 
  isValidAxis, 
  isValidKey, 
  isValidPin,
  normalizeCommand
} from './commandTypes.js';

/**
 * Utility to format a standard validation result.
 * 
 * @param {boolean} ok - True if validation passes
 * @param {string} message - Status or error message
 * @param {Object} [extra={}] - Additional details to append
 * @returns {Object} ValidationResult
 */
export function createValidationResult(ok, message, extra = {}) {
  return {
    ok: !!ok,
    message: String(message),
    severity: extra.severity || (ok ? "info" : "error"),
    ...extra
  };
}

/**
 * Validates a target coordinate object for finite numbers.
 * 
 * @param {Object} target - The target {x, y, z} coordinates
 * @returns {Object} ValidationResult
 */
export function validateTarget(target) {
  if (!target || typeof target !== "object") {
    return createValidationResult(false, "Target coordinates object is missing or invalid.");
  }
  
  const { x, y, z } = target;
  
  if (typeof x !== "number" || !Number.isFinite(x) ||
      typeof y !== "number" || !Number.isFinite(y) ||
      typeof z !== "number" || !Number.isFinite(z)) {
    return createValidationResult(false, "Target coordinates x, y, and z must be finite numbers.");
  }
  
  return createValidationResult(true, "Target coordinates are valid numbers.");
}

/**
 * Validates if a target coordinate lies within conservative workspace bounds.
 * 
 * @param {Object} target - The target {x, y, z} coordinates
 * @returns {Object} ValidationResult
 */
export function validateWorkspace(target) {
  const numCheck = validateTarget(target);
  if (!numCheck.ok) return numCheck;

  const { x, y, z } = target;
  const bounds = WORKSPACE_BOUNDS;

  if (x < bounds.x.min || x > bounds.x.max) {
    return createValidationResult(false, `Target X coordinate (${x.toFixed(3)}m) is outside bounds [${bounds.x.min}m, ${bounds.x.max}m].`);
  }
  if (y < bounds.y.min || y > bounds.y.max) {
    return createValidationResult(false, `Target Y coordinate (${y.toFixed(3)}m) is outside bounds [${bounds.y.min}m, ${bounds.y.max}m].`);
  }
  if (z < bounds.z.min || z > bounds.z.max) {
    return createValidationResult(false, `Target Z coordinate (${z.toFixed(3)}m) is outside bounds [${bounds.z.min}m, ${bounds.z.max}m].`);
  }

  return createValidationResult(true, "Target is inside the allowed workspace bounds.");
}

/**
 * Validates a PIN format.
 * 
 * @param {string} pin - 6-digit PIN comprised of keys 1-6
 * @returns {Object} ValidationResult
 */
export function validatePin(pin) {
  if (isValidPin(pin)) {
    return createValidationResult(true, "PIN format is valid.");
  }
  return createValidationResult(false, "Invalid PIN. Must be exactly 6 digits containing only numbers 1 to 6.");
}

/**
 * Validates key label and existence in config coordinates.
 * 
 * @param {string} key - Button digit string '1' to '6'
 * @param {Object} [keyConfig] - Loaded key.config.json object
 * @returns {Object} ValidationResult
 */
export function validateKey(key, keyConfig) {
  if (!isValidKey(key)) {
    return createValidationResult(false, `Invalid key label '${key}'. Must be a character from '1' to '6'.`);
  }

  if (keyConfig && keyConfig.keys) {
    if (!keyConfig.keys[key]) {
      return createValidationResult(false, `Key '${key}' does not exist in key configuration file.`);
    }
  }

  return createValidationResult(true, `Key '${key}' is valid.`);
}

/**
 * Validates a joint rotation command relative to robot limits.
 * 
 * @param {Object} command - Structured rotateJoint command
 * @param {Object} [robotAdapter] - Visual/physical robot model adapter
 * @returns {Object} ValidationResult
 */
export function validateJointCommand(command, robotAdapter) {
  if (!command || command.type !== COMMAND_TYPES.ROTATE_JOINT) {
    return createValidationResult(false, "Invalid joint command type.");
  }

  const { jointName, deltaDeg } = command;

  if (!jointName) {
    return createValidationResult(false, "Joint name is missing in joint rotation command.");
  }

  if (typeof deltaDeg !== "number" || !Number.isFinite(deltaDeg)) {
    return createValidationResult(false, "Joint delta angle must be a finite number of degrees.");
  }

  if (robotAdapter) {
    // Check joint existence
    if (typeof robotAdapter.getMovableJoints === "function") {
      const movableJoints = robotAdapter.getMovableJoints() || [];
      if (!movableJoints.includes(jointName)) {
        return createValidationResult(false, `Joint '${jointName}' is not a movable joint in the active model.`);
      }
    }

    // Check joint limit constraints
    if (typeof robotAdapter.getJointLimits === "function" && typeof robotAdapter.getJointAngles === "function") {
      const currentAngles = robotAdapter.getJointAngles() || {};
      const currentAngle = currentAngles[jointName];

      if (currentAngle !== undefined) {
        const deltaRad = (deltaDeg * Math.PI) / 180;
        const predictedAngle = currentAngle + deltaRad;

        const limits = robotAdapter.getJointLimits() || {};
        const limit = limits[jointName];

        if (limit) {
          const minVal = limit.min !== undefined ? limit.min : limit.lower;
          const maxVal = limit.max !== undefined ? limit.max : limit.upper;
          if (typeof minVal === 'number' && typeof maxVal === 'number') {
            if (predictedAngle < minVal || predictedAngle > maxVal) {
              return createValidationResult(
                false,
                `Rotating joint '${jointName}' by ${deltaDeg}° would result in angle (${predictedAngle.toFixed(3)} rad) violating limit [${minVal.toFixed(3)}, ${maxVal.toFixed(3)}].`
              );
            }
          }
        }
      }
    }
  }

  return createValidationResult(true, "Joint command passes boundaries check.");
}

/**
 * Validates any structured command object prior to execution.
 * Normalizes the input command first.
 * 
 * @param {Object} command - Raw command object
 * @param {Object} [context={}] - Environment context, e.g. { robotAdapter, keyConfig }
 * @returns {Object} ValidationResult
 */
export function validateCommand(command, context = {}) {
  let normalized;
  try {
    normalized = normalizeCommand(command);
  } catch (err) {
    return createValidationResult(false, err.message);
  }

  const { type } = normalized;

  switch (type) {
    case COMMAND_TYPES.JOG: {
      const { axis, delta } = normalized;
      if (!isValidAxis(axis)) {
        return createValidationResult(false, `Invalid jog axis '${axis}'. Must be 'x', 'y', or 'z'.`);
      }
      if (typeof delta !== "number" || !Number.isFinite(delta)) {
        return createValidationResult(false, "Jog delta must be a finite number.");
      }
      if (Math.abs(delta) > 0.10) {
        return createValidationResult(false, `Jog step size (${delta.toFixed(3)}m) exceeds maximum threshold of 0.10m.`);
      }
      if (context.robotAdapter && typeof context.robotAdapter.getEndEffectorPosition === "function") {
        try {
          const currentPos = context.robotAdapter.getEndEffectorPosition();
          if (currentPos) {
            const targetPos = {
              x: currentPos.x + (axis === 'x' ? delta : 0),
              y: currentPos.y + (axis === 'y' ? delta : 0),
              z: currentPos.z + (axis === 'z' ? delta : 0)
            };
            const workspaceCheck = validateWorkspace(targetPos);
            if (!workspaceCheck.ok) {
              return createValidationResult(false, `Jog target outside bounds: ${workspaceCheck.message}`);
            }
          }
        } catch (err) {}
      }
      return createValidationResult(true, "Jog command is valid.");
    }

    case COMMAND_TYPES.MOVE_TO: {
      const workspaceCheck = validateWorkspace(normalized.target);
      if (!workspaceCheck.ok) return workspaceCheck;
      return createValidationResult(true, "MoveTo target is safe.");
    }

    case COMMAND_TYPES.PRESS_KEY: {
      const keyCheck = validateKey(normalized.key, context.keyConfig);
      if (!keyCheck.ok) return keyCheck;
      return createValidationResult(true, "PressKey command is valid.");
    }

    case COMMAND_TYPES.RUN_PIN: {
      const pinCheck = validatePin(normalized.pin);
      if (!pinCheck.ok) return pinCheck;
      return createValidationResult(true, "RunPin sequence format is valid.");
    }

    case COMMAND_TYPES.ROTATE_JOINT: {
      return validateJointCommand(normalized, context.robotAdapter);
    }

    case COMMAND_TYPES.HOME:
    case COMMAND_TYPES.STOP:
      return createValidationResult(true, `Command [${type}] is always valid.`);

    default:
      return createValidationResult(false, `Unknown command type: ${type}`);
  }
}
