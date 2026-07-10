// src/core/motionPipeline.js
import { CommandTypes } from './commandTypes.js';
import { robotStore } from './robotStore.js';
import { validateMotion } from './safetyValidator.js';

/**
 * Global entry point for all command execution.
 * Rules:
 * 1. Must handle all command sources.
 * 2. Must run every proposed state through the safety validator.
 * 3. Updates state store or dispatches to trajectory runners.
 * 
 * @param {Object} command - Command matching the schema in commandTypes.js
 * @param {string} command.type - E.g. CommandTypes.MOVE_EE
 * @param {Object} command.payload - E.g. { dx, dy, dz }
 * @param {string} command.source - Origin identifier ('keyboard', 'joystick', 'voice', 'autonomous')
 * @returns {Promise<Object>} Result of execution { success: boolean, message: string }
 */
export async function executeCommand(command) {
  const { type, payload, source } = command;
  const state = robotStore.getState();

  // Log incoming command
  robotStore.setState((prev) => ({
    logs: [
      ...prev.logs,
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        message: `Command [${type}] received from [${source}]`
      }
    ]
  }));

  // Block motions if safety is tripped (except reset commands)
  if (state.safety.tripped && type !== CommandTypes.RESET_SAFETY) {
    return { success: false, message: 'System halted. Safety state must be reset.' };
  }

  switch (type) {
    case CommandTypes.MOVE_EE:
      return handleMoveEE(payload, source);

    case CommandTypes.SET_EE:
      return handleSetEE(payload, source);

    case CommandTypes.JOG_JOINT:
      return handleJogJoint(payload, source);

    case CommandTypes.SET_JOINTS:
      return handleSetJoints(payload, source);

    case CommandTypes.TAP_KEY:
      return handleTapKey(payload, source);

    case CommandTypes.EXECUTE_PIN:
      return handleExecutePin(payload, source);

    case CommandTypes.RESET_SAFETY:
      robotStore.setState({ safety: { tripped: false, message: null, violationCount: 0 } });
      return { success: true, message: 'Safety state reset.' };

    case CommandTypes.HALT:
      robotStore.setState((prev) => ({
        safety: { ...prev.safety, tripped: true, message: 'Emergency Halt Triggered.' },
        motion: { ...prev.motion, isMoving: false, activeTrajectoryPath: [] }
      }));
      return { success: true, message: 'Emergency halt triggered.' };

    default:
      return { success: false, message: `Unknown command type: ${type}` };
  }
}

// Internal contract handlers (to be fully implemented in Phase B)
function handleMoveEE(payload, source) {
  // 1. Calculate target coordinates using relative delta payload.dx, payload.dy, payload.dz
  // 2. Solve IK
  // 3. Run validation
  // 4. Update store / start trajectory runner
  return Promise.resolve({ success: true, message: 'Relative EE step accepted.' });
}

function handleSetEE(payload, source) {
  // 1. Target coordinate absolute payload.x, payload.y, payload.z
  // 2. Solve IK
  // 3. Run validation
  // 4. Update store / start trajectory runner
  return Promise.resolve({ success: true, message: 'Absolute EE target accepted.' });
}

function handleJogJoint(payload, source) {
  // 1. Calculate target angles relative to payload.jointId and payload.delta
  // 2. Run validation (joint limits, collisions)
  // 3. Update store
  return Promise.resolve({ success: true, message: 'Joint jog accepted.' });
}

function handleSetJoints(payload, source) {
  // 1. Target absolute angles payload.angles [q1, q2, q3, q4, q5, q6]
  // 2. Run validation
  // 3. Update store
  return Promise.resolve({ success: true, message: 'Absolute joints accepted.' });
}

function handleTapKey(payload, source) {
  // 1. Lookup key coord from key.config.json by payload.keyId
  // 2. Schedule trajectory sequence through pinRunner
  return Promise.resolve({ success: true, message: 'Key tap routine queued.' });
}

function handleExecutePin(payload, source) {
  // 1. Trigger full 6-digit PIN autonomous tap execution
  return Promise.resolve({ success: true, message: 'PIN autonomous sequence queued.' });
}
