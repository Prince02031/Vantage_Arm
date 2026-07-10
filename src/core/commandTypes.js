// src/core/commandTypes.js

/**
 * Supported motion and control command types.
 * @constant {Object}
 */
export const COMMAND_TYPES = {
  JOG: "jog",
  MOVE_TO: "moveTo",
  PRESS_KEY: "pressKey",
  RUN_PIN: "runPin",
  HOME: "home",
  STOP: "stop",
  ROTATE_JOINT: "rotateJoint"
};

/**
 * Standard trigger sources for commands.
 * @constant {Object}
 */
export const COMMAND_SOURCES = {
  KEYBOARD: "keyboard",
  JOYSTICK: "joystick",
  DASHBOARD: "dashboard",
  VOICE: "voice",
  AGENTIC: "agentic",
  PIN_PANEL: "pin-panel",
  UNKNOWN: "unknown"
};

/**
 * Valid Cartesian axes.
 * @constant {Array<string>}
 */
export const AXES = ["x", "y", "z"];

/**
 * Regular expression validating a 6-digit PIN comprised of keys 1-6.
 * @constant {RegExp}
 */
export const PIN_REGEX = /^[1-6]{6}$/;

/**
 * Default jog step size in meters.
 * @constant {number}
 */
export const DEFAULT_JOG_STEP = 0.02;

/**
 * Accuracy tolerance in meters for a successful key press.
 * @constant {number}
 */
export const TOUCH_TOLERANCE_M = 0.005;

/**
 * Offset in meters above key to hover before pressing.
 * @constant {number}
 */
export const KEY_APPROACH_OFFSET_M = 0.05;

/**
 * Conservative physical workspace boundaries in meters (relative to base frame).
 * @constant {Object}
 */
export const WORKSPACE_BOUNDS = {
  x: { min: 0.15, max: 0.75 },
  y: { min: -0.35, max: 0.35 },
  z: { min: 0.02, max: 0.75 }
};

/**
 * Checks if a value is a valid axis coordinate name.
 * @param {any} axis - The value to test
 * @returns {boolean} True if the axis is valid ('x', 'y', 'z')
 */
export function isValidAxis(axis) {
  return typeof axis === "string" && AXES.includes(axis.toLowerCase());
}

/**
 * Checks if a value is a valid key label ('1' to '6').
 * @param {any} key - The value to test
 * @returns {boolean} True if key is a digit 1-6
 */
export function isValidKey(key) {
  const str = String(key);
  return /^[1-6]$/.test(str);
}

/**
 * Checks if a value is a valid 6-digit PIN string comprised of keys 1-6.
 * @param {any} pin - The value to test
 * @returns {boolean} True if pin is valid
 */
export function isValidPin(pin) {
  if (typeof pin !== "string" && typeof pin !== "number") {
    return false;
  }
  return PIN_REGEX.test(String(pin));
}

/**
 * Creates a Jog command object.
 * @param {string} axis - The axis to jog ('x', 'y', 'z')
 * @param {number} [delta=DEFAULT_JOG_STEP] - Increment size in meters
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured Jog command
 */
export function createJogCommand(axis, delta = DEFAULT_JOG_STEP, source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.JOG,
    axis: String(axis).toLowerCase(),
    delta: Number(delta),
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a MoveTo command object.
 * @param {Object} target - The destination coordinates { x, y, z }
 * @param {number} target.x - Target X in meters
 * @param {number} target.y - Target Y in meters
 * @param {number} target.z - Target Z in meters
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured MoveTo command
 */
export function createMoveToCommand(target, source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.MOVE_TO,
    target: {
      x: Number(target.x),
      y: Number(target.y),
      z: Number(target.z)
    },
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a PressKey command object.
 * @param {string|number} key - Key digit '1' to '6'
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured PressKey command
 */
export function createPressKeyCommand(key, source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.PRESS_KEY,
    key: String(key),
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a RunPin command object.
 * @param {string|number} pin - 6-digit PIN comprised of 1-6
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured RunPin command
 */
export function createRunPinCommand(pin, source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.RUN_PIN,
    pin: String(pin),
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a Home command object.
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured Home command
 */
export function createHomeCommand(source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.HOME,
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a Stop command object.
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured Stop command
 */
export function createStopCommand(source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.STOP,
    source: String(source).toLowerCase()
  };
}

/**
 * Creates a RotateJoint command object.
 * @param {string} jointName - Joint name (e.g., 'joint_1')
 * @param {number} deltaDeg - Relative angle change in degrees
 * @param {string} [source=COMMAND_SOURCES.UNKNOWN] - Trigger origin
 * @returns {Object} Structured RotateJoint command
 */
export function createRotateJointCommand(jointName, deltaDeg, source = COMMAND_SOURCES.UNKNOWN) {
  return {
    type: COMMAND_TYPES.ROTATE_JOINT,
    jointName: String(jointName),
    deltaDeg: Number(deltaDeg),
    source: String(source).toLowerCase()
  };
}

/**
 * Normalizes an arbitrary command object, adding defaults and converting datatypes.
 * Returns a new object without mutating the input command.
 * 
 * @param {Object} command - The raw command object to normalize
 * @returns {Object} The normalized, validated copy of the command
 */
export function normalizeCommand(command) {
  if (!command || typeof command !== "object") {
    throw new Error("Invalid command: Command must be a non-null object.");
  }

  const normalized = {
    type: String(command.type),
    source: command.source ? String(command.source).toLowerCase() : COMMAND_SOURCES.UNKNOWN
  };

  switch (normalized.type) {
    case COMMAND_TYPES.JOG:
      normalized.axis = command.axis ? String(command.axis).toLowerCase() : "x";
      normalized.delta = command.delta !== undefined ? Number(command.delta) : DEFAULT_JOG_STEP;
      break;

    case COMMAND_TYPES.MOVE_TO:
      if (!command.target || typeof command.target !== "object") {
        throw new Error("Invalid moveTo command: missing target object.");
      }
      normalized.target = {
        x: Number(command.target.x),
        y: Number(command.target.y),
        z: Number(command.target.z)
      };
      break;

    case COMMAND_TYPES.PRESS_KEY:
      if (command.key === undefined) {
        throw new Error("Invalid pressKey command: missing key value.");
      }
      normalized.key = String(command.key);
      break;

    case COMMAND_TYPES.RUN_PIN:
      if (command.pin === undefined) {
        throw new Error("Invalid runPin command: missing pin value.");
      }
      normalized.pin = String(command.pin);
      break;

    case COMMAND_TYPES.ROTATE_JOINT:
      if (command.jointName === undefined || command.deltaDeg === undefined) {
        throw new Error("Invalid rotateJoint command: missing jointName or deltaDeg.");
      }
      normalized.jointName = String(command.jointName);
      normalized.deltaDeg = Number(command.deltaDeg);
      break;

    case COMMAND_TYPES.HOME:
    case COMMAND_TYPES.STOP:
      // Home and stop only need type and source
      break;

    default:
      // For forward compatibility, keep any extra fields
      Object.keys(command).forEach(key => {
        if (!(key in normalized)) {
          normalized[key] = command[key];
        }
      });
      break;
  }

  return normalized;
}
