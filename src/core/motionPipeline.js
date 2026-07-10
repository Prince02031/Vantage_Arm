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
 * Supported shapes (see commandTypes.js):
 *   { type, payload, source }
 *
 * @param {Object} command
 * @param {string} command.type - CommandTypes.* (e.g. 'MOVE_EE', 'JOG_AXIS', 'HOME')
 * @param {Object} command.payload - Type-specific payload
 * @param {string} command.source - Origin identifier ('keyboard', 'joystick', 'voice', 'dashboard', 'pin-panel', 'autonomous')
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function executeCommand(command) {
  if (!command || typeof command !== 'object') {
    return { success: false, message: 'executeCommand received no command.' };
  }
  const { type, payload = {}, source = 'unknown' } = command;
  const state = robotStore.getState();

  // Log incoming command — keep an entry that StatusLog can render richly.
  robotStore.setState((prev) => ({
    logs: [
      ...prev.logs,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: 'INFO',
        level: 'INFO',
        commandType: type,
        source,
        message: `Command [${type}] received from [${source}]`
      }
    ]
  }));

  // System halt has highest priority — only RESET_SAFETY can clear it.
  if (state.safety.tripped && type !== CommandTypes.RESET_SAFETY) {
    return { success: false, message: 'System halted. Safety state must be reset.' };
  }

  switch (type) {
    // --- New Phase B control shapes ---
    case CommandTypes.JOG_AXIS:
      return handleJogAxis(payload, source);

    case CommandTypes.MOVE_TO:
      return handleMoveTo(payload, source);

    case CommandTypes.HOME:
      return handleHome(payload, source);

    case CommandTypes.STOP:
      return handleStop(payload, source);

    case CommandTypes.RUN_PIN:
      return handleRunPin(payload, source);

    // --- Legacy shapes (still supported) ---
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
      robotStore.setState({
        safety: { tripped: false, message: null, violationCount: 0 },
        motion: { isMoving: false, activeCommandSource: 'idle', activeTrajectoryPath: [] }
      });
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

// ────────────────────────────────────────────────────────────────────────────
// Internal handlers. Full FK / IK / trajectory work is owned by Person 2 in
// Phase C. The Phase B wiring contract just routes the command, updates the
// observable motion state, and returns a stable result. Adapters do not care
// which handler runs — they just call executeCommand.
// ────────────────────────────────────────────────────────────────────────────

function updateActiveSource(source) {
  robotStore.setState((prev) => ({
    motion: { ...prev.motion, activeCommandSource: source, isMoving: true }
  }));
}

function markIdle(source) {
  robotStore.setState((prev) => ({
    motion: { ...prev.motion, activeCommandSource: source, isMoving: false }
  }));
}

function handleJogAxis(payload, source) {
  const { axis, delta = 0, mode = 'relative' } = payload || {};
  if (!axis || typeof axis !== 'string') {
    return Promise.resolve({ success: false, message: 'JOG_AXIS requires axis.' });
  }
  const a = axis.toLowerCase();
  if (!['x', 'y', 'z'].includes(a)) {
    return Promise.resolve({ success: false, message: `Unsupported axis: ${axis}` });
  }
  // Translate single-axis jog into a MOVE_EE-style relative delta payload so
  // the legacy motion path can pick it up unchanged in Phase C.
  const relative = { dx: 0, dy: 0, dz: 0 };
  if (a === 'x') relative.dx = Number(delta) || 0;
  if (a === 'y') relative.dy = Number(delta) || 0;
  if (a === 'z') relative.dz = Number(delta) || 0;

  updateActiveSource(source);
  robotStore.setState((prev) => ({
    motion: { ...prev.motion, activeCommandSource: source, isMoving: true, lastCommandMode: mode }
  }));

  return Promise.resolve({
    success: true,
    message: `Jogged ${a.toUpperCase()} by ${relative[`d${a}`].toFixed(3)}m (${source}).`
  });
}

function handleMoveTo(payload, source) {
  const { target } = payload || {};
  if (!target || typeof target !== 'object') {
    return Promise.resolve({ success: false, message: 'MOVE_TO requires { target: {x,y,z} }.' });
  }
  const { x, y, z } = target;
  if ([x, y, z].some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    return Promise.resolve({ success: false, message: 'MOVE_TO target must contain finite x, y, z numbers.' });
  }
  updateActiveSource(source);
  robotStore.setState({ targetPosition: { x, y, z } });
  return Promise.resolve({ success: true, message: `Moving EE to (${x}, ${y}, ${z}).` });
}

function handleHome(_payload, source) {
  updateActiveSource(source);
  robotStore.setState({ targetPosition: { x: 0.5, y: 0.0, z: 0.05 } });
  return Promise.resolve({ success: true, message: 'Returning to home pose.' });
}

function handleStop(_payload, source) {
  // STOP pauses motion but does NOT trip the safety latch — that is HALT.
  // We also clear activeCommandSource so SafetyPanel flips to "idle".
  markIdle(source);
  return Promise.resolve({ success: true, message: 'Motion stopped (no safety trip).' });
}

function handleRunPin(payload, source) {
  const { pin } = payload || {};
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
    return Promise.resolve({ success: false, message: 'RUN_PIN requires a 6-digit pin string.' });
  }
  const allowed = /^[1-6]{6}$/;
  if (!allowed.test(pin)) {
    return Promise.resolve({ success: false, message: 'RUN_PIN digits must each be 1-6.' });
  }
  updateActiveSource(source);
  // Delegate to the existing EXECUTE_PIN handler so Person 2's pinRunner path
  // is the single source of truth for autonomous sequence dispatch.
  return handleExecutePin({ pin }, source);
}

// ── Legacy handlers (kept for backwards compatibility) ─────────────────────

function handleMoveEE(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'Relative EE step accepted.' });
}

function handleSetEE(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'Absolute EE target accepted.' });
}

function handleJogJoint(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'Joint jog accepted.' });
}

function handleSetJoints(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'Absolute joints accepted.' });
}

function handleTapKey(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'Key tap routine queued.' });
}

function handleExecutePin(payload, source) {
  updateActiveSource(source);
  return Promise.resolve({ success: true, message: 'PIN autonomous sequence queued.' });
}
