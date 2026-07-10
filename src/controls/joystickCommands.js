// src/controls/joystickCommands.js
import { CommandTypes } from '../core/commandTypes.js';

/**
 * Joystick command adapter (Phase B).
 *
 * Translates GUI joystick inputs (axis pushes + Home/Stop) into the
 * standardized `executeCommand(command)` contract. NEVER mutates the robot
 * directly. The motion pipeline owns the actual state change.
 *
 * @param {Object} options
 * @param {Function} options.executeCommand - The global executeCommand(command).
 * @param {string}  options.source         - Override for source tag. Defaults to 'joystick'.
 * @param {number}  options.defaultDelta   - Default per-click delta in meters. Defaults to 0.02m.
 */
export function createJoystickAdapter({
  executeCommand,
  source = 'joystick',
  defaultDelta = 0.02
} = {}) {
  if (typeof executeCommand !== 'function') {
    throw new Error('createJoystickAdapter requires executeCommand(command)');
  }

  /**
   * Push the end-effector along a single Cartesian axis by `delta` meters.
   * `axis` is one of 'x' | 'y' | 'z'. Sign of `delta` selects the direction.
   * Emits the canonical 'jog' type that motionPipeline.js handles natively.
   */
  function pushAxis(axis, delta = defaultDelta) {
    const a = String(axis || '').toLowerCase();
    if (!['x', 'y', 'z'].includes(a)) {
      throw new Error(`Unsupported joystick axis: ${axis}`);
    }
    return executeCommand({
      type: 'jog',
      axis: a,
      delta: Number(delta) || 0,
      source
    });
  }

  /**
   * Convenience helpers for the labeled joystick buttons.
   */
  function xPlus()  { return pushAxis('x',  defaultDelta); }
  function xMinus() { return pushAxis('x', -defaultDelta); }
  function yPlus()  { return pushAxis('y',  defaultDelta); }
  function yMinus() { return pushAxis('y', -defaultDelta); }
  function zPlus()  { return pushAxis('z',  defaultDelta); }
  function zMinus() { return pushAxis('z', -defaultDelta); }

  /**
   * Return to a known home pose. Goes through executeCommand → pipeline.
   */
  function home() {
    return executeCommand({ type: 'home', source });
  }

  /**
   * Soft stop — pauses motion without tripping the safety latch.
   */
  function stop() {
    return executeCommand({ type: 'stop', source });
  }

  /**
   * Emergency halt — trips the safety latch.
   */
  function halt() {
    return executeCommand({ type: 'halt', source });
  }

  /**
   * Reset the safety latch.
   */
  function resetSafety() {
    return executeCommand({ type: 'resetSafety', source });
  }

  return {
    pushAxis,
    xPlus, xMinus,
    yPlus, yMinus,
    zPlus, zMinus,
    home,
    stop,
    halt,
    resetSafety,
    defaultDelta,
    source
  };
}
