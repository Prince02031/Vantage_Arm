// src/controls/keyboardCommands.js
import { CommandTypes } from '../core/commandTypes.js';

/**
 * Keyboard command adapter (Phase B).
 *
 * Maps physical key codes to motion-pipeline commands. KeyboardHelp installs a
 * global keydown + keyup listener pair that calls `handleKey(code)`. This
 * module is purely a mapper — it never touches robot state.
 *
 * Default keymap (per Person 3 spec):
 *   W / S     →  +X / −X   (EE)
 *   A / D     →  +Y / −Y   (EE)
 *   Q / E     →  +Z / −Z   (EE)
 *   H         →  HOME
 *   Space     →  STOP
 *
 * Repeat suppression: a held key does not spam commands. Only the first
 * keydown of a sequence is dispatched until the user releases the key.
 *
 * @param {Object} options
 * @param {Function} options.executeCommand - The global executeCommand(command).
 * @param {string}  options.source         - Defaults to 'keyboard'.
 * @param {number}  options.defaultDelta   - Per-keypress EE step in meters. Default 0.02m.
 */
export function createKeyboardAdapter({
  executeCommand,
  source = 'keyboard',
  defaultDelta = 0.02
} = {}) {
  if (typeof executeCommand !== 'function') {
    throw new Error('createKeyboardAdapter requires executeCommand(command)');
  }

  function send(type, payload = {}) {
    return executeCommand({ type, source, ...payload });
  }

  function jogAxis(axis, sign) {
    return executeCommand({ type: 'jog', axis, delta: sign * defaultDelta, source });
  }

  const handlers = {
    // End-Effector Cartesian jogging (single-axis per key)
    KeyW: () => jogAxis('x', +1),
    KeyS: () => jogAxis('x', -1),
    KeyA: () => jogAxis('y', +1),
    KeyD: () => jogAxis('y', -1),
    KeyQ: () => jogAxis('z', +1),
    KeyE: () => jogAxis('z', -1),

    // System commands
    KeyH: () => executeCommand({ type: 'home', source }),
    Space: () => executeCommand({ type: 'stop', source })
  };

  // Track held keys so a single physical press is one command, regardless of
  // keydown repeat events from the OS.
  const heldKeys = new Set();

  /**
   * Dispatch a KeyboardEvent.code. Returns true if handled.
   * Suppresses key-repeat spam, re-triggers only after key release, and
   * ignores keystrokes while the user is typing into a text input.
   */
  function handleKey(code, event) {
    // Don't hijack the keys when the user is typing into an input.
    if (event && event.target) {
      const tag = event.target.tagName;
      const editable = event.target.isContentEditable;
      if (editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return false;
      }
    }

    const fn = handlers[code];
    if (!fn) {
      // Always release the held-key latch on unknown keys so we never deadlock.
      heldKeys.delete(code);
      return false;
    }
    if (event && event.repeat) {
      // ignore OS-level repeat; we already saw the first keydown
      return true;
    }
    if (heldKeys.has(code)) return true;
    heldKeys.add(code);
    if (event) event.preventDefault();
    fn();
    return true;
  }

  function handleKeyUp(code) {
    heldKeys.delete(code);
  }

  /**
   * Install a paired keydown + keyup listener. Returns an uninstall function
   * that React's useEffect cleanup can call on unmount.
   */
  function install(target = window) {
    const onDown = (e) => handleKey(e.code, e);
    const onUp   = (e) => handleKeyUp(e.code);
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      heldKeys.clear();
    };
  }

  return { handleKey, handleKeyUp, install, source, defaultDelta };
}

/**
 * Static reference map used by the on-screen KeyboardHelp component.
 * Mirrors the handlers above for display purposes only.
 */
export const KEYBOARD_BINDINGS = [
  { group: 'End-Effector (Cartesian)', entries: [
    { keys: ['W'], label: 'Move EE +X (right)' },
    { keys: ['S'], label: 'Move EE −X (left)' },
    { keys: ['A'], label: 'Move EE +Y (forward)' },
    { keys: ['D'], label: 'Move EE −Y (back)' },
    { keys: ['Q'], label: 'Move EE +Z (up)' },
    { keys: ['E'], label: 'Move EE −Z (down)' }
  ]},
  { group: 'System', entries: [
    { keys: ['H'],     label: 'Home pose' },
    { keys: ['Space'], label: 'Stop motion (no safety trip)' }
  ]}
];
