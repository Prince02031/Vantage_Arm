// src/core/commandTypes.js

/**
 * Supported motion and control command types (internal).
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
 * Supported motion and control command types (Person 3 dashboard).
 */
export const CommandTypes = {
  MOVE_EE: 'MOVE_EE',
  SET_EE: 'SET_EE',
  JOG_AXIS: 'JOG_AXIS',
  MOVE_TO: 'MOVE_TO',
  JOG_JOINT: 'JOG_JOINT',
  SET_JOINTS: 'SET_JOINTS',
  HOME: 'HOME',
  STOP: 'STOP',
  HALT: 'HALT',
  RESET_SAFETY: 'RESET_SAFETY',
  TAP_KEY: 'TAP_KEY',
  EXECUTE_PIN: 'EXECUTE_PIN',
  RUN_PIN: 'RUN_PIN'
};

/**
 * Helpful metadata for log rendering.
 */
export const CommandMeta = {
  MOVE_EE:       { label: 'MOVE_EE',       short: 'EE Δ' },
  SET_EE:        { label: 'SET_EE',        short: 'EE →' },
  JOG_AXIS:      { label: 'JOG_AXIS',      short: 'EE axis' },
  MOVE_TO:       { label: 'MOVE_TO',       short: 'EE →' },
  JOG_JOINT:     { label: 'JOG_JOINT',     short: 'Joint Δ' },
  SET_JOINTS:    { label: 'SET_JOINTS',    short: 'Joints' },
  HOME:          { label: 'HOME',          short: 'Home' },
  STOP:          { label: 'STOP',          short: 'Stop' },
  HALT:          { label: 'HALT',          short: 'Halt' },
  RESET_SAFETY:  { label: 'RESET_SAFETY',  short: 'Reset' },
  TAP_KEY:       { label: 'TAP_KEY',       short: 'Tap' },
  EXECUTE_PIN:   { label: 'EXECUTE_PIN',   short: 'PIN' },
  RUN_PIN:       { label: 'RUN_PIN',       short: 'PIN' }
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
 * Physical workspace boundaries in meters (world frame, matching the URDF/Three.js scene).
 * These are hard safety limits — generous enough for the full arm reach while
 * preventing wildly out-of-range targets.
 * NOTE: These are in world/scene coordinates, not base-relative coordinates.
 * Measured from observed EE positions: home ≈ (0, 0, 1.5m).
 * @constant {Object}
 */
export const WORKSPACE_BOUNDS = {
  x: { min: -1.2, max: 1.2 },
  y: { min: -1.2, max: 1.2 },
  z: { min:  0.0, max: 2.5 }
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

  // Flatten payload fields if present:
  let raw = { ...command };
  if (command.payload && typeof command.payload === "object") {
    raw = { ...raw, ...command.payload };
  }

  // Map incoming type string to standard internal command type
  let typeStr = String(raw.type);
  if (typeStr === "JOG_AXIS" || typeStr === "JOG") {
    typeStr = COMMAND_TYPES.JOG;
  } else if (typeStr === "MOVE_TO") {
    typeStr = COMMAND_TYPES.MOVE_TO;
  } else if (typeStr === "TAP_KEY" || typeStr === "PRESS_KEY") {
    typeStr = COMMAND_TYPES.PRESS_KEY;
  } else if (typeStr === "EXECUTE_PIN" || typeStr === "RUN_PIN") {
    typeStr = COMMAND_TYPES.RUN_PIN;
  } else if (typeStr === "HOME") {
    typeStr = COMMAND_TYPES.HOME;
  } else if (typeStr === "STOP") {
    typeStr = COMMAND_TYPES.STOP;
  } else if (typeStr === "HALT") {
    typeStr = "halt";
  } else if (typeStr === "RESET_SAFETY") {
    typeStr = "resetSafety";
  }

  const normalized = {
    type: typeStr,
    source: raw.source ? String(raw.source).toLowerCase() : COMMAND_SOURCES.UNKNOWN
  };

  switch (normalized.type) {
    case COMMAND_TYPES.JOG:
      normalized.axis = raw.axis ? String(raw.axis).toLowerCase() : (raw.axisName ? String(raw.axisName).toLowerCase() : "x");
      normalized.delta = raw.delta !== undefined ? Number(raw.delta) : DEFAULT_JOG_STEP;
      break;

    case COMMAND_TYPES.MOVE_TO:
      if (!raw.target || typeof raw.target !== "object") {
        throw new Error("Invalid moveTo command: missing target object.");
      }
      normalized.target = {
        x: Number(raw.target.x),
        y: Number(raw.target.y),
        z: Number(raw.target.z)
      };
      break;

    case COMMAND_TYPES.PRESS_KEY: {
      const keyVal = raw.key !== undefined ? raw.key : raw.keyId;
      if (keyVal === undefined) {
        throw new Error("Invalid pressKey command: missing key value.");
      }
      normalized.key = String(keyVal);
      break;
    }

    case COMMAND_TYPES.RUN_PIN:
      if (raw.pin === undefined) {
        throw new Error("Invalid runPin command: missing pin value.");
      }
      normalized.pin = String(raw.pin);
      break;

    case COMMAND_TYPES.ROTATE_JOINT:
      if (raw.jointName === undefined || raw.deltaDeg === undefined) {
        throw new Error("Invalid rotateJoint command: missing jointName or deltaDeg.");
      }
      normalized.jointName = String(raw.jointName);
      normalized.deltaDeg = Number(raw.deltaDeg);
      break;

    case COMMAND_TYPES.HOME:
    case COMMAND_TYPES.STOP:
    case "halt":
    case "resetSafety":
      // These only need type and source
      break;

    default:
      // For forward compatibility, keep any extra fields
      Object.keys(raw).forEach(key => {
        if (!(key in normalized) && key !== "payload") {
          normalized[key] = raw[key];
        }
      });
      break;
  }

  return normalized;
}
