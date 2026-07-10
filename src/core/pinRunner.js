// src/core/pinRunner.js
import { KEY_APPROACH_OFFSET_M, PIN_REGEX } from './commandTypes.js';
import { setRobotState, addStatusLog, isStopRequested, clearStopRequest } from './robotStore.js';

/**
 * Builds the Cartesian target coordinates for a key press sequence.
 * Targets are:
 * 1. approach: hover offset height (5cm) above key
 * 2. touch: actual key coordinate
 * 3. retreat: hover height after key click
 * 
 * @param {string} key - Digit string '1' to '6'
 * @param {Object} keyConfig - Loaded keys coordinates map from key.config.json
 * @returns {Object} Target plan containing approach, touch, and retreat coordinates
 */
export function buildKeyPressTargets(key, keyConfig) {
  const coords = keyConfig?.keys?.[key];
  if (!coords) {
    throw new Error(`Coordinates for key '${key}' not found in key configuration.`);
  }

  const offset = KEY_APPROACH_OFFSET_M || 0.05;

  return {
    key: String(key),
    approach: { x: coords.x, y: coords.y, z: coords.z + offset },
    touch: { x: coords.x, y: coords.y, z: coords.z },
    retreat: { x: coords.x, y: coords.y, z: coords.z + offset }
  };
}

/**
 * Validates a PIN format and verifies that all digits are present in key config.
 * 
 * @param {string} pin - 6-digit PIN string
 * @param {Object} keyConfig - Loaded keys coordinates map
 * @returns {Object} Validation report { ok: boolean, message: string }
 */
export function validatePinAgainstConfig(pin, keyConfig) {
  if (typeof pin !== "string" || !PIN_REGEX.test(pin)) {
    return { ok: false, message: "Invalid PIN format. PIN must be exactly 6 digits containing numbers 1 to 6." };
  }

  if (keyConfig && keyConfig.keys) {
    for (let i = 0; i < pin.length; i++) {
      const digit = pin[i];
      if (!keyConfig.keys[digit]) {
        return { ok: false, message: `Key coordinate configuration is missing digit '${digit}' from the PIN.` };
      }
    }
  }

  return { ok: true, message: "PIN is valid and matching key configuration." };
}

/**
 * Creates the initial tracking state structure for PIN entry progress.
 * 
 * @param {string} pin - Target PIN
 * @returns {Object} Initial pinProgress state
 */
export function createPinProgress(pin) {
  return {
    pin: String(pin),
    currentIndex: -1,
    currentKey: "",
    pressed: [],
    results: [],
    failed: false,
    failureReason: "",
    complete: false,
    running: false
  };
}

/**
 * Updates the PIN sequence progress in the global robot state store.
 * 
 * @param {Object} partial - Sub-properties of pinProgress
 */
export function updatePinProgress(partial) {
  setRobotState({
    pinProgress: partial
  });
}

/**
 * Plans a single key press routine.
 * Phase A behavior: Validates key, builds coordinates, and returns a structured plan description.
 * 
 * @param {string} key - Digit string '1' to '6'
 * @param {Object} [context={}] - Execution context containing { keyConfig, executeCommand }
 * @returns {Object} KeyPress plan result
 */
export function pressKey(key, context = {}) {
  const strKey = String(key);
  if (!/^[1-6]$/.test(strKey)) {
    return { ok: false, message: `Key '${key}' is invalid. Must be '1' through '6'.` };
  }

  try {
    const targets = buildKeyPressTargets(strKey, context.keyConfig);
    return {
      ok: true,
      key: strKey,
      targets,
      message: `Key press plan created for key ${strKey}.`,
      pendingImplementation: false
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Executes a full 6-digit PIN autonomous entry routine.
 * 
 * @param {string} pin - 6-digit PIN string
 * @param {Object} context - Execution context containing { keyConfig, robotAdapter, executePressKey, source }
 * @returns {Promise<Object>} PIN sequence result
 */
export async function runPin(pin, context = {}) {
  const strPin = String(pin);
  const validation = validatePinAgainstConfig(strPin, context.keyConfig);

  if (!validation.ok) {
    addStatusLog({
      level: "error",
      message: `PIN Validation Failed: ${validation.message}`,
      source: context.source || "unknown",
      commandType: "runPin"
    });
    return { ok: false, message: validation.message };
  }

  // If no robot adapter is registered, planning-only mode
  if (!context.robotAdapter) {
    // Generate targets sequence plan
    const plan = [];
    try {
      for (let i = 0; i < strPin.length; i++) {
        const key = strPin[i];
        const keyPlan = buildKeyPressTargets(key, context.keyConfig);
        plan.push(keyPlan);
      }
    } catch (err) {
      return { ok: false, message: `Failed to compile PIN path targets: ${err.message}` };
    }

    return {
      ok: true,
      pin: strPin,
      plan,
      message: "Autonomous PIN path plan generated successfully.",
      pendingImplementation: true
    };
  }

  // Execution mode
  // Initialize and write progress to store
  const progress = {
    pin: strPin,
    currentIndex: -1,
    currentKey: "",
    pressed: [],
    results: [],
    failed: false,
    failureReason: "",
    complete: false,
    running: true
  };
  setRobotState({ pinProgress: progress });

  addStatusLog({
    level: "info",
    message: `Starting autonomous PIN sequence [${strPin}].`,
    source: context.source || "unknown",
    commandType: "runPin"
  });

  // Ensure stop request flag is cleared at startup of a new run
  clearStopRequest();

  let pinSuccess = true;
  let failureReason = "";

  for (let i = 0; i < strPin.length; i++) {
    const digit = strPin[i];

    // Check if stop requested
    if (isStopRequested()) {
      failureReason = "Aborted due to stop request.";
      addStatusLog({
        level: "warning",
        message: `PIN sequence [${strPin}] aborted at index ${i} ('${digit}') due to stop request.`,
        source: "runPin"
      });
      
      pinSuccess = false;
      break;
    }

    // Update progress state for current key
    progress.currentIndex = i;
    progress.currentKey = digit;
    setRobotState({ pinProgress: { ...progress } });

    addStatusLog({
      level: "info",
      message: `PIN sequence: Pressing digit ${i + 1}/6 ('${digit}')...`,
      source: "runPin"
    });

    let pressRes;
    try {
      if (typeof context.executePressKey === "function") {
        pressRes = await context.executePressKey(digit);
      } else {
        throw new Error("executePressKey function missing from context.");
      }
    } catch (err) {
      pressRes = { ok: false, message: err.message, data: { errorM: 1.0 } };
    }

    // Record per-key result
    const keyResult = {
      key: digit,
      index: i,
      ok: pressRes.ok,
      errorM: pressRes.data?.errorM !== undefined ? pressRes.data.errorM : null,
      message: pressRes.message || "",
      timestamp: Date.now()
    };
    progress.results.push(keyResult);

    if (pressRes.ok) {
      progress.pressed.push(digit);
      setRobotState({ pinProgress: { ...progress } });
    } else {
      pinSuccess = false;
      failureReason = pressRes.message || `Failed at digit '${digit}'`;
      addStatusLog({
        level: "error",
        message: `PIN sequence [${strPin}] stopped: Digit '${digit}' failed. Error: ${failureReason}`,
        source: "runPin"
      });
      break;
    }
  }

  // Update final state of progress
  progress.running = false;
  if (pinSuccess) {
    progress.complete = true;
    setRobotState({ pinProgress: { ...progress } });
    addStatusLog({
      level: "success",
      message: `Autonomous PIN entry [${strPin}] completed successfully.`,
      source: context.source || "unknown",
      commandType: "runPin"
    });
    return { ok: true, message: `PIN sequence [${strPin}] executed successfully.`, data: progress };
  } else {
    progress.failed = true;
    progress.failureReason = failureReason;
    setRobotState({ pinProgress: { ...progress } });
    addStatusLog({
      level: "error",
      message: `Autonomous PIN entry [${strPin}] failed: ${failureReason}`,
      source: context.source || "unknown",
      commandType: "runPin"
    });
    return { ok: false, message: `PIN sequence execution failed: ${failureReason}`, data: progress };
  }
}
